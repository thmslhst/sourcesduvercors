/**
 * Offline write outbox (ARCHITECTURE.md § Write path offline): observations
 * and reactions created without connectivity are appended here, keyed by
 * their client-generated UUID, and replayed by lib/offline/sync.ts. The
 * UUID makes replay idempotent — re-sending is always safe.
 *
 * Nothing leaves this store without the hiker asking. A write the server
 * refuses outright is *kept*, stamped with why (`failure`), and skipped by
 * later flushes so it can neither wedge the queue nor be re-sent forever.
 * It stays visible until the hiker retries or deletes it: the taps were
 * spent standing at a spring, and discarding that behind a dismissable
 * banner is the one thing an offline-first outbox may never do.
 */

import type {
  ObservationStatus,
  ObservationTag,
} from "@/lib/domain/constants";
import { OUTBOX_STORE, idbDelete, idbGet, idbGetAll, idbPut } from "./idb";

/** Why the server refused a write for good — all terminal, none retriable blindly. */
export type FailureReason =
  /** Older than the accepted window; publishing it now would misdate it. */
  | "too_old"
  /** A confirmation of the hiker's own observation (self-inflation). */
  | "own_observation"
  /** Queued in a shape the app no longer has an endpoint for. */
  | "retired"
  /** Any other terminal refusal (source delisted, id conflict, bad body). */
  | "rejected";

export interface OutboxFailure {
  reason: FailureReason;
  /** When the refusal came back (ISO) — shown, so the report is datable. */
  at: string;
  /** HTTP status, for diagnosis only; never rendered raw. */
  status?: number;
}

interface QueuedBase {
  enqueuedAt: string;
  /** Set once the server refused it for good; unset while still sendable. */
  failure?: OutboxFailure;
}

export interface QueuedObservation extends QueuedBase {
  kind: "observation";
  /** Client UUID — also the observation id sent to the API. */
  id: string;
  body: {
    id: string;
    sourceId: string;
    status: ObservationStatus;
    tags?: ObservationTag[];
    /** When the hiker was at the source (queue time), not sync time. */
    observedAt: string;
  };
}

export interface QueuedReaction extends QueuedBase {
  kind: "reaction";
  /**
   * Outbox key — derived from the observation, not random, so re-tapping
   * confirm *replaces* the queued reaction instead of stacking a new one.
   * The server upserts on (observation, user), so only the last tap could
   * ever apply; queueing the earlier ones would inflate the pending count
   * with writes that are already superseded. Observations are the opposite
   * — each is a distinct append-only fact — so they keep their own UUID as
   * the key.
   */
  id: string;
  /** Client UUID of the reaction row itself (idempotent replay). */
  reactionId: string;
  observationId: string;
  /**
   * The source the observation belongs to. Not needed to send — the API
   * addresses the observation — but a blocked confirmation has to be able
   * to name where the hiker was standing, and only the sheet knows that.
   */
  sourceId?: string;
  /**
   * Retired: items queued before the dispute reaction was removed may still
   * carry `type: "dispute"`. sync.ts refuses those rather than delivering
   * them as confirmations, which would invert what the hiker meant.
   */
  type?: "confirm" | "dispute";
}

/** The one outbox slot a given observation's reaction may occupy. */
export function reactionOutboxKey(observationId: string): string {
  return `reaction:${observationId}`;
}

export type OutboxItem = QueuedObservation | QueuedReaction;

type OutboxListener = (items: OutboxItem[]) => void;
const listeners = new Set<OutboxListener>();

async function notify(): Promise<void> {
  const items = await listOutbox();
  for (const listener of listeners) listener(items);
}

/** Subscribe to outbox changes; fires immediately with the current contents. */
export function subscribeOutbox(listener: OutboxListener): () => void {
  listeners.add(listener);
  void listOutbox().then((items) => {
    if (listeners.has(listener)) listener(items);
  });
  return () => listeners.delete(listener);
}

export async function enqueueOutbox(item: OutboxItem): Promise<void> {
  await idbPut(OUTBOX_STORE, item);
  await notify();
}

/** Oldest first — replay preserves the order the hiker acted in. */
export async function listOutbox(): Promise<OutboxItem[]> {
  try {
    const items = await idbGetAll<OutboxItem>(OUTBOX_STORE);
    return items.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
  } catch {
    return [];
  }
}

/** The items a flush may still try — everything not already refused. */
export async function listSendableOutbox(): Promise<OutboxItem[]> {
  return (await listOutbox()).filter((item) => item.failure === undefined);
}

/**
 * Record a terminal refusal against an item, keeping it. Replaces the old
 * "remove and report once" path: the count is now readable off the store
 * itself, so a repeated flush can't double-report the same loss.
 */
export async function markOutboxFailed(
  id: string,
  failure: OutboxFailure,
): Promise<void> {
  const item = await idbGet<OutboxItem>(OUTBOX_STORE, id);
  // Deleted from the blocked list while the flush was in flight — the
  // hiker's decision wins; don't resurrect the row.
  if (!item) return;
  await idbPut(OUTBOX_STORE, { ...item, failure });
  await notify();
}

/** Clear a refusal so the next flush tries the item again. */
export async function retryOutboxItem(id: string): Promise<void> {
  const item = await idbGet<OutboxItem>(OUTBOX_STORE, id);
  if (!item) return;
  const sendable = { ...item };
  delete sendable.failure;
  await idbPut(OUTBOX_STORE, sendable);
  await notify();
}

export async function removeOutboxItem(id: string): Promise<void> {
  await idbDelete(OUTBOX_STORE, id);
  await notify();
}
