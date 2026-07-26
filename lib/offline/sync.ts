/**
 * Outbox replay (ARCHITECTURE.md § Write path offline). Client-side sync:
 * flush on reconnect, on app focus/visibility, and on a slow interval —
 * the on-focus path is the reliable one on iOS, where SW Background Sync
 * doesn't exist. Replay is idempotent (client UUIDs), so retrying is
 * always safe.
 */

import { listOutbox, removeOutboxItem, type OutboxItem } from "./outbox";

export interface FlushResult {
  /** Items accepted by the server during this flush. */
  sent: number;
  /** Items still queued (offline, server error, or signed out). */
  remaining: number;
}

function requestFor(item: OutboxItem): { url: string; body: unknown } {
  if (item.kind === "observation") {
    return { url: "/api/v1/observations", body: item.body };
  }
  return {
    url: `/api/v1/observations/${item.observationId}/${item.type}`,
    body: { id: item.id },
  };
}

/**
 * Replay one item. Returns:
 * - "sent"     → accepted (2xx), remove from the outbox
 * - "dropped"  → terminal 4xx (source gone, own observation, duplicate…);
 *                retrying can never succeed, so remove rather than wedge
 *                the queue forever
 * - "blocked"  → transient (network down, 5xx) or needs sign-in (401);
 *                keep the item and stop this flush
 */
async function replayItem(
  item: OutboxItem,
): Promise<"sent" | "dropped" | "blocked"> {
  const { url, body } = requestFor(item);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return "blocked"; // network — still offline
  }
  if (res.ok) return "sent";
  if (res.status === 401 || res.status >= 500) return "blocked";
  console.warn(`[outbox] dropping ${item.kind} ${item.id}: HTTP ${res.status}`);
  return "dropped";
}

let inFlight: Promise<FlushResult> | null = null;

/** Replay the outbox, oldest first. Serialized — concurrent calls share one run. */
export function flushOutbox(): Promise<FlushResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    let sent = 0;
    const items = await listOutbox();
    let remaining = items.length;
    for (const item of items) {
      const outcome = await replayItem(item);
      if (outcome === "blocked") break;
      await removeOutboxItem(item.id);
      remaining -= 1;
      if (outcome === "sent") sent += 1;
    }
    return { sent, remaining };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

const RETRY_INTERVAL_MS = 60_000;

/**
 * Install the sync triggers; returns a cleanup function. `onSynced` fires
 * after any flush that delivered at least one item, so the UI can re-fetch
 * the snapshot (derived statuses changed server-side).
 */
export function startSyncTriggers(onSynced: () => void): () => void {
  const flush = () => {
    void flushOutbox().then(({ sent }) => {
      if (sent > 0) onSynced();
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
