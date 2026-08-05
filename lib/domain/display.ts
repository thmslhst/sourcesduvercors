/**
 * Display derivation shared by API, map, and (later) offline cache.
 *
 * The map never shows a stale stored status as if it were current: when
 * confidence has decayed to `unknown` (no observation within the known
 * window), the displayed status is `unknown` too, whatever was stored.
 */

import type { Confidence, DisplayStatus, ObservationStatus } from "./constants";
import { deriveConfidence } from "./confidence";
import type { SourceSnapshotItem } from "./snapshot";

export function deriveDisplayStatus(
  status: ObservationStatus | null,
  confidence: Confidence,
): DisplayStatus {
  if (confidence === "unknown" || status === null) return "unknown";
  return status;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Age of an ISO timestamp in fractional days. */
export function ageInDays(iso: string, now: Date = new Date()): number {
  return (now.getTime() - Date.parse(iso)) / MS_PER_DAY;
}

/**
 * Re-derive a cached snapshot item against the current clock: a source cached
 * as high confidence days ago must degrade while offline (ARCHITECTURE.md
 * § Data flow). Fresh data passes through unchanged.
 *
 * This runs the real rule, not an approximation of it — the snapshot carries
 * both of `deriveConfidence`'s inputs, so the offline client reaches exactly
 * the value the server would. Time only ever moves the result downward.
 */
export function decaySnapshotItem(
  item: SourceSnapshotItem,
  now: Date,
): SourceSnapshotItem {
  const ageDays =
    item.lastObservedAt === null
      ? null
      : (now.getTime() - Date.parse(item.lastObservedAt)) / MS_PER_DAY;
  const confidence = deriveConfidence({
    ageDays,
    confirmations: item.confirmationCount,
  });
  if (confidence === item.confidence) return item;
  return {
    ...item,
    confidence,
    status: deriveDisplayStatus(
      item.status === "unknown" ? null : item.status,
      confidence,
    ),
  };
}

/**
 * Map colors per DOMAIN.md § Status scale (colorblind-safe, final palette
 * still TBD there). Used by the map layers and the detail sheet badge.
 */
export const STATUS_COLORS: Record<DisplayStatus, string> = {
  flowing: "#2563eb", // blue
  low_flow: "#0d9488", // teal
  dripping: "#ea580c", // orange
  dry: "#dc2626", // red
  unknown: "#6b7280", // gray
};
