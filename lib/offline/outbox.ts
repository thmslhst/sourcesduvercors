/**
 * Offline write outbox (ARCHITECTURE.md § Write path offline): observations
 * and reactions created without connectivity are appended here, keyed by
 * their client-generated UUID, and replayed by lib/offline/sync.ts. The
 * UUID makes replay idempotent — re-sending is always safe.
 */

import type {
  ObservationStatus,
  ObservationTag,
  ReactionType,
} from "@/lib/domain/constants";
import { OUTBOX_STORE, idbDelete, idbGetAll, idbPut } from "./idb";

export interface QueuedObservation {
  kind: "observation";
  /** Client UUID — also the observation id sent to the API. */
  id: string;
  enqueuedAt: string;
  body: {
    id: string;
    sourceId: string;
    status: ObservationStatus;
    tags?: ObservationTag[];
    /** When the hiker was at the source (queue time), not sync time. */
    observedAt: string;
  };
}

export interface QueuedReaction {
  kind: "reaction";
  /**
   * Outbox key — derived from the observation, not random, so re-tapping
   * confirm/dispute *replaces* the queued reaction instead of stacking a new
   * one. The server upserts on (observation, user) and treats confirm ⇄
   * dispute as an edit, so only the last tap could ever apply; queueing the
   * earlier ones would inflate the pending count with writes that are
   * already superseded. Observations are the opposite — each is a distinct
   * append-only fact — so they keep their own UUID as the key.
   */
  id: string;
  /** Client UUID of the reaction row itself (idempotent replay). */
  reactionId: string;
  enqueuedAt: string;
  observationId: string;
  type: ReactionType;
}

/** The one outbox slot a given observation's reaction may occupy. */
export function reactionOutboxKey(observationId: string): string {
  return `reaction:${observationId}`;
}

export type OutboxItem = QueuedObservation | QueuedReaction;

type OutboxListener = (count: number) => void;
const listeners = new Set<OutboxListener>();

async function notify(): Promise<void> {
  const count = await countOutbox();
  for (const listener of listeners) listener(count);
}

/** Subscribe to pending-count changes; fires immediately with the current count. */
export function subscribeOutbox(listener: OutboxListener): () => void {
  listeners.add(listener);
  void countOutbox().then((count) => {
    if (listeners.has(listener)) listener(count);
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

export async function countOutbox(): Promise<number> {
  return (await listOutbox()).length;
}

export async function removeOutboxItem(id: string): Promise<void> {
  await idbDelete(OUTBOX_STORE, id);
  await notify();
}
