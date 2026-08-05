/**
 * Outbox replay (ARCHITECTURE.md § Write path offline). Client-side sync:
 * flush on reconnect, on app focus/visibility, and on a slow interval —
 * the on-focus path is the reliable one on iOS, where SW Background Sync
 * doesn't exist. Replay is idempotent (client UUIDs), so retrying is
 * always safe.
 */

import { listOutbox, removeOutboxItem, type OutboxItem } from "./outbox";

/** Why a flush stopped before draining the queue. */
export type BlockedReason =
  /** Needs a signed-in session — only the user can unblock this. */
  | "auth"
  /** Network unreachable; the triggers will retry. */
  | "offline"
  /** Server error; the triggers will retry. */
  | "server";

/** Why an item was removed without being delivered. */
export type DropReason =
  /** Sat in the outbox past the observed_at window — unsendable, ever. */
  | "too_old"
  /** Terminal 4xx (source gone, own observation, id conflict…). */
  | "other";

export interface FlushResult {
  /** Items accepted by the server during this flush. */
  sent: number;
  /** Items still queued (offline, server error, or signed out). */
  remaining: number;
  /**
   * Set when the flush stopped early. "auth" is the one the UI must act on:
   * retrying can never clear it, so the queue needs a visible way in
   * (MapShell surfaces a sign-in prompt) or it wedges forever.
   */
  blockedBy: BlockedReason | null;
  /** Items dropped this flush — surfaced, never silently lost. */
  dropped: DropReason[];
}

function requestFor(item: OutboxItem): { url: string; body: unknown } {
  if (item.kind === "observation") {
    return { url: "/api/v1/observations", body: item.body };
  }
  return {
    url: `/api/v1/observations/${item.observationId}/${item.type}`,
    // `?? item.id` covers items queued before the key/payload split, whose
    // own id *was* the reaction UUID; the server generates one if neither is
    // a UUID, so a stale item can never wedge the queue.
    body: { id: item.reactionId ?? item.id },
  };
}

type ReplayOutcome =
  /** Accepted (2xx) — remove from the outbox. */
  | { kind: "sent" }
  /** Terminal — retrying can never succeed, so remove rather than wedge. */
  | { kind: "dropped"; reason: DropReason }
  /** Keep the item and stop this flush; the caller reports why. */
  | { kind: "blocked"; reason: BlockedReason };

async function replayItem(item: OutboxItem): Promise<ReplayOutcome> {
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
  const reason: DropReason = error === "observed_at_too_old" ? "too_old" : "other";
  console.warn(
    `[outbox] dropping ${item.kind} ${item.id}: HTTP ${res.status} ${error ?? ""}`,
  );
  return { kind: "dropped", reason };
}

let inFlight: Promise<FlushResult> | null = null;

/** Replay the outbox, oldest first. Serialized — concurrent calls share one run. */
export function flushOutbox(): Promise<FlushResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    let sent = 0;
    let blockedBy: BlockedReason | null = null;
    const dropped: DropReason[] = [];
    const items = await listOutbox();
    let remaining = items.length;
    for (const item of items) {
      const outcome = await replayItem(item);
      if (outcome.kind === "blocked") {
        blockedBy = outcome.reason;
        break;
      }
      await removeOutboxItem(item.id);
      remaining -= 1;
      if (outcome.kind === "sent") sent += 1;
      else dropped.push(outcome.reason);
    }
    return { sent, remaining, blockedBy, dropped };
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
