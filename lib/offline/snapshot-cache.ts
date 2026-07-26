/**
 * IndexedDB persistence of the `GET /api/v1/sources` snapshot — layer 2 of
 * the offline strategy (ARCHITECTURE.md). Offline reads hit this first; the
 * stored `fetchedAt` drives the "données du <time>" honesty indicator.
 *
 * Every failure path resolves to "no cache" — IndexedDB being unavailable
 * (private mode, storage eviction) must never break the online app.
 */

import type { SourcesSnapshot } from "@/lib/domain/snapshot";
import { SNAPSHOT_STORE, idbGet, idbPut } from "./idb";

const SNAPSHOT_KEY = "current";

export interface CachedSnapshot {
  snapshot: SourcesSnapshot;
  /** ISO timestamp of when the client fetched it from the network. */
  fetchedAt: string;
}

export async function saveSnapshot(
  snapshot: SourcesSnapshot,
  fetchedAt: Date = new Date(),
): Promise<void> {
  const cached: CachedSnapshot = {
    snapshot,
    fetchedAt: fetchedAt.toISOString(),
  };
  try {
    await idbPut(SNAPSHOT_STORE, cached, SNAPSHOT_KEY);
  } catch {
    // Best-effort cache; the in-memory snapshot still renders.
  }
}

export async function loadSnapshot(): Promise<CachedSnapshot | null> {
  try {
    const cached = await idbGet<CachedSnapshot>(SNAPSHOT_STORE, SNAPSHOT_KEY);
    return cached ?? null;
  } catch {
    return null;
  }
}
