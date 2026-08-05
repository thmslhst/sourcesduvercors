import { CONFIDENCE_WINDOWS_DAYS, type Confidence } from "./constants";

export interface ConfidenceInput {
  /** Days since the latest non-deleted observation; null when none exists. */
  ageDays: number | null;
  confirmations: number;
}

/**
 * Derive confidence from the latest observation's age and confirmations.
 *
 * This is the TypeScript mirror of the CASE expression in the
 * `source_current_status` SQL view — the server always uses the view; the
 * offline client re-runs this over the cached snapshot, which carries both
 * inputs (`lastObservedAt`, `confirmationCount`). The two are locked together
 * by unit tests. Keep them identical.
 */
export function deriveConfidence({
  ageDays,
  confirmations,
}: ConfidenceInput): Confidence {
  if (ageDays === null || ageDays > CONFIDENCE_WINDOWS_DAYS.known) {
    return "unknown";
  }
  if (ageDays <= CONFIDENCE_WINDOWS_DAYS.high && confirmations >= 1) {
    return "high";
  }
  if (ageDays <= CONFIDENCE_WINDOWS_DAYS.medium) {
    return "medium";
  }
  return "low";
}
