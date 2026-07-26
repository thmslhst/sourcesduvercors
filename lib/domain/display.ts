/**
 * Display derivation shared by API, map, and (later) offline cache.
 *
 * The map never shows a stale stored status as if it were current: when
 * confidence has decayed to `unknown` (no observation within the known
 * window), the displayed status is `unknown` too, whatever was stored.
 */

import type { Confidence, DisplayStatus, ObservationStatus } from "./constants";

export function deriveDisplayStatus(
  status: ObservationStatus | null,
  confidence: Confidence,
): DisplayStatus {
  if (confidence === "unknown" || status === null) return "unknown";
  return status;
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
