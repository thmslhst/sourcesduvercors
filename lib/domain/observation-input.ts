/**
 * Validation of observation submissions, shared by the API route today and
 * the offline outbox replay in Phase 3 — one set of rules, one place.
 *
 * DATABASE.md: the server clamps `observed_at` to <= now and to a sane past
 * window; client clock skew is accepted, never trusted.
 */

import {
  OBSERVATION_STATUSES,
  type ObservationStatus,
} from "./constants";

export const COMMENT_MAX_LENGTH = 500;
/** How far in the past an observation may claim to have happened. */
export const OBSERVED_AT_MAX_PAST_DAYS = 7;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ObservationInput {
  /** Client-generated UUID (offline idempotency key). */
  id: string;
  sourceId: string;
  status: ObservationStatus;
  comment: string | null;
  /** Clamped into [now − 7 days, now]. */
  observedAt: Date;
}

export type ParseResult =
  | { ok: true; value: ObservationInput }
  | { ok: false; error: string };

export function parseObservationInput(
  body: unknown,
  now: Date = new Date(),
): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "invalid_body" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.id !== "string" || !UUID_RE.test(b.id)) {
    return { ok: false, error: "invalid_id" };
  }
  if (typeof b.sourceId !== "string" || !UUID_RE.test(b.sourceId)) {
    return { ok: false, error: "invalid_source_id" };
  }
  if (
    typeof b.status !== "string" ||
    !(OBSERVATION_STATUSES as readonly string[]).includes(b.status)
  ) {
    return { ok: false, error: "invalid_status" };
  }

  let comment: string | null = null;
  if (b.comment != null) {
    if (typeof b.comment !== "string") {
      return { ok: false, error: "invalid_comment" };
    }
    comment = b.comment.trim() || null;
    if (comment !== null && comment.length > COMMENT_MAX_LENGTH) {
      return { ok: false, error: "comment_too_long" };
    }
  }

  const observedAtMs =
    typeof b.observedAt === "string" ? Date.parse(b.observedAt) : NaN;
  if (Number.isNaN(observedAtMs)) {
    return { ok: false, error: "invalid_observed_at" };
  }
  const floor = now.getTime() - OBSERVED_AT_MAX_PAST_DAYS * 24 * 60 * 60 * 1000;
  const observedAt = new Date(
    Math.min(Math.max(observedAtMs, floor), now.getTime()),
  );

  return {
    ok: true,
    value: {
      id: b.id.toLowerCase(),
      sourceId: b.sourceId.toLowerCase(),
      status: b.status as ObservationStatus,
      comment,
      observedAt,
    },
  };
}
