/**
 * Outbox replay (ARCHITECTURE.md § Write path offline). Client-side sync:
 * flush on reconnect, on app focus/visibility, and on a slow interval —
 * the on-focus path is the reliable one on iOS, where SW Background Sync
 * doesn't exist. Replay is idempotent (client UUIDs), so retrying is
 * always safe.
 *
 * Two outcomes stop an item: a *block* (offline, server error, no session)
 * keeps it queued and stops the flush there, preserving order; a *refusal*
 * (terminal 4xx) keeps it too, stamped with why, and the flush moves on to
 * the rest. Nothing is deleted here — only the hiker deletes contributions
 * (lib/offline/outbox.ts).
 */

import {
  listSendableOutbox,
  markOutboxFailed,
  removeOutboxItem,
  type FailureReason,
  type OutboxItem,
} from "./outbox";

/** Why a flush stopped before draining the queue. */
export type BlockedReason =
  /** Needs a signed-in session — only the user can unblock this. */
  | "auth"
  /** Network unreachable; the triggers will retry. */
  | "offline"
  /** Server error; the triggers will retry. */
  | "server";

export interface FlushResult {
  /** Items accepted by the server during this flush. */
  sent: number;
  /** Items still sendable (offline, server error, or signed out). */
  pending: number;
  /** Items refused for good this flush — kept, and now needing a decision. */
  failed: number;
  /**
   * Set when the flush stopped early. "auth" is the one the UI must act on:
   * retrying can never clear it, so the queue needs a visible way in
   * (MapShell surfaces a sign-in prompt) or it wedges forever.
   */
  blockedBy: BlockedReason | null;
}

function requestFor(item: OutboxItem): { url: string; body: unknown } {
  if (item.kind === "observation") {
    return { url: "/api/v1/observations", body: item.body };
  }
  return {
    url: `/api/v1/observations/${item.observationId}/confirm`,
    // `?? item.id` covers items queued before the key/payload split, whose
    // own id *was* the reaction UUID; the server generates one if neither is
    // a UUID, so a stale item can never wedge the queue.
    body: { id: item.reactionId ?? item.id },
  };
}

/**
 * A dispute queued before the reaction was retired (DOMAIN.md § Confirmation).
 * There is no endpoint left to deliver it to, and the one remaining endpoint
 * means the opposite, so the item is refused rather than sent.
 */
function isRetiredDispute(item: OutboxItem): boolean {
  return item.kind === "reaction" && item.type === "dispute";
}

/** Terminal 4xx → the reason the blocked list will explain to the hiker. */
function failureReasonFor(error: string | undefined): FailureReason {
  if (error === "observed_at_too_old") return "too_old";
  // 403 on the confirm endpoint has exactly one cause, and it is worth
  // naming: a signed-out sheet cannot tell whose observation it is showing,
  // so this is the confirmation the hiker was allowed to queue but the
  // domain never allows to land (DOMAIN.md § Confirmation).
  if (error === "own_observation") return "own_observation";
  return "rejected";
}

type ReplayOutcome =
  /** Accepted (2xx) — remove from the outbox. */
  | { kind: "sent" }
  /** Terminal — retrying can never succeed on its own; keep it and say why. */
  | { kind: "failed"; reason: FailureReason; status?: number }
  /** Keep the item and stop this flush; the caller reports why. */
  | { kind: "blocked"; reason: BlockedReason };

async function replayItem(item: OutboxItem): Promise<ReplayOutcome> {
  if (isRetiredDispute(item)) {
    return { kind: "failed", reason: "retired" };
  }
  const { url, body } = requestFor(item);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "blocked", reason: "offline" };
  }
  if (res.ok) return { kind: "sent" };
  // 401 is the deferred-auth case: captured offline while signed out, or the
  // session expired since. The item is good — it just needs a session.
  if (res.status === 401) return { kind: "blocked", reason: "auth" };
  if (res.status >= 500) return { kind: "blocked", reason: "server" };

  const error = await res
    .json()
    .then((b: unknown) => (b as { error?: string })?.error)
    .catch(() => undefined);
  console.warn(
    `[outbox] ${item.kind} ${item.id} refused: HTTP ${res.status} ${error ?? ""}`,
  );
  return {
    kind: "failed",
    reason: failureReasonFor(error),
    status: res.status,
  };
}

let inFlight: Promise<FlushResult> | null = null;

/** Replay the outbox, oldest first. Serialized — concurrent calls share one run. */
export function flushOutbox(): Promise<FlushResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    let sent = 0;
    let failed = 0;
    let blockedBy: BlockedReason | null = null;
    const items = await listSendableOutbox();
    let pending = items.length;
    for (const item of items) {
      const outcome = await replayItem(item);
      if (outcome.kind === "blocked") {
        blockedBy = outcome.reason;
        break;
      }
      pending -= 1;
      if (outcome.kind === "sent") {
        await removeOutboxItem(item.id);
        sent += 1;
      } else {
        // Kept, not discarded: one refusal must not take the contribution
        // with it, and must not stop the items behind it either.
        await markOutboxFailed(item.id, {
          reason: outcome.reason,
          at: new Date().toISOString(),
          status: outcome.status,
        });
        failed += 1;
      }
    }
    return { sent, pending, failed, blockedBy };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

const RETRY_INTERVAL_MS = 60_000;

export interface SyncTriggerHandlers {
  /**
   * Fires after any flush that delivered at least one item, so the UI can
   * re-fetch the snapshot (derived statuses changed server-side).
   */
  onSynced: () => void;
  /** Fires after every flush, so the UI can report why one stalled. */
  onResult?: (result: FlushResult) => void;
}

/** Install the sync triggers; returns a cleanup function. */
export function startSyncTriggers({
  onSynced,
  onResult,
}: SyncTriggerHandlers): () => void {
  const flush = () => {
    void flushOutbox().then((result) => {
      if (result.sent > 0) onSynced();
      onResult?.(result);
    });
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") flush();
  };

  window.addEventListener("online", flush);
  window.addEventListener("focus", flush);
  document.addEventListener("visibilitychange", onVisible);
  const interval = window.setInterval(flush, RETRY_INTERVAL_MS);
  flush(); // app start

  return () => {
    window.removeEventListener("online", flush);
    window.removeEventListener("focus", flush);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
  };
}
