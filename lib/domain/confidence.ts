import { CONFIDENCE_WINDOWS_DAYS, type Confidence } from "./constants";

export interface ConfidenceInput {
  /** Days since the latest non-deleted observation; null when none exists. */
  ageDays: number | null;
  confirmations: number;
  disputes: number;
}

/**
 * Derive confidence from the latest observation's age and reactions.
 *
 * This is the TypeScript mirror of the CASE expression in the
 * `source_current_status` SQL view — the server always uses the view;
 * this function exists for offline age-based decay (ARCHITECTURE.md) and
 * is locked to the view's semantics by unit tests. Keep them identical.
 */
export function deriveConfidence({
  ageDays,
  confirmations,
  disputes,
}: ConfidenceInput): Confidence {
  if (ageDays === null || ageDays > CONFIDENCE_WINDOWS_DAYS.known) {
    return "unknown";
  }
  if (disputes > 0) {
    return "low";
  }
  if (ageDays <= CONFIDENCE_WINDOWS_DAYS.high && confirmations >= 1) {
    return "high";
  }
  if (ageDays <= CONFIDENCE_WINDOWS_DAYS.medium) {
    return "medium";
  }
  return "low";
}

const CONFIDENCE_RANK: Record<Confidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};

/**
 * Offline age-based decay of a *cached* confidence (ARCHITECTURE.md § Data
 * flow). The snapshot doesn't carry dispute counts, so the client can't
 * re-run `deriveConfidence`; instead it caps the server-derived value by the
 * best confidence the observation's age still allows. Decay is monotonic —
 * it only ever downgrades, never upgrades.
 */
export function decayConfidence(
  cached: Confidence,
  ageDays: number | null,
): Confidence {
  let cap: Confidence;
  if (ageDays === null || ageDays > CONFIDENCE_WINDOWS_DAYS.known) {
    cap = "unknown";
  } else if (ageDays > CONFIDENCE_WINDOWS_DAYS.medium) {
    cap = "low";
  } else if (ageDays > CONFIDENCE_WINDOWS_DAYS.high) {
    cap = "medium";
  } else {
    cap = "high";
  }
  return CONFIDENCE_RANK[cap] < CONFIDENCE_RANK[cached] ? cap : cached;
}
