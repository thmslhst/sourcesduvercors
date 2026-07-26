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
