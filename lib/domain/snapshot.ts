/**
 * Shape of the `GET /api/v1/sources` snapshot payload (ARCHITECTURE.md § API).
 * Shared by the route handler, the map client, and (Phase 3) the IndexedDB
 * cache — the offline sync payload is exactly this object.
 */

import type { Confidence, DisplayStatus, SourceType } from "./constants";

export interface SourceSnapshotItem {
  id: string;
  name: string | null;
  type: SourceType;
  lat: number;
  lon: number;
  elevationM: number | null;
  /** Already collapsed to `unknown` when confidence is `unknown`. */
  status: DisplayStatus;
  confidence: Confidence;
  /** ISO timestamp of the latest observation; null when none. */
  lastObservedAt: string | null;
  confirmationCount: number;
}

export interface SourcesSnapshot {
  region: string;
  /** ODbL attribution — keep intact wherever the data is displayed. */
  attribution: string;
  sources: SourceSnapshotItem[];
}

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";
