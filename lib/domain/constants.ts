/**
 * Shared domain vocabulary and confidence constants — see DOMAIN.md.
 *
 * The confidence day-windows are mirrored in the `source_current_status`
 * SQL view (prisma/migrations). Change them in both places or not at all.
 */

export const SOURCE_TYPES = [
  "spring",
  "fountain",
  "drinking_water",
  "cistern",
  "stream",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Stored observation statuses. `unknown` is derived, never stored. */
export const OBSERVATION_STATUSES = [
  "flowing",
  "low_flow",
  "dripping",
  "dry",
] as const;
export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number];

/** What the map displays: a stored status or the derived `unknown`. */
export type DisplayStatus = ObservationStatus | "unknown";

export const CONFIDENCE_LEVELS = ["high", "medium", "low", "unknown"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const REACTION_TYPES = ["confirm", "dispute"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

/**
 * Closed vocabulary of optional details on an observation (DOMAIN.md
 * § Observation). A 4-value status can't say *why*, and for a fountain or a
 * cistern "dry" may mean a broken tap rather than a dry spring.
 *
 * These are descriptive only: **no tag feeds the confidence model.** Trust is
 * derived from age, confirmations and disputes and nothing else — keep it
 * that way (§ Confidence model, and the `source_current_status` view).
 */
export const OBSERVATION_TAGS = [
  "cloudy_water",
  "hard_access",
  "wrong_location",
  "broken_fixture",
] as const;
export type ObservationTag = (typeof OBSERVATION_TAGS)[number];

/** Age windows in days (DOMAIN.md § Confidence model, v1). */
export const CONFIDENCE_WINDOWS_DAYS = {
  /** high requires age ≤ this AND ≥ 1 confirmation AND no disputes */
  high: 7,
  /** medium requires age ≤ this AND no disputes */
  medium: 21,
  /** beyond this the source is `unknown` regardless of anything else */
  known: 60,
} as const;
