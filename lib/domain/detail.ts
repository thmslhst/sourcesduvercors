/**
 * Shape of the `GET /api/v1/sources/:id` payload: source + derived status
 * (same item as the snapshot) plus recent observation history — what the
 * detail sheet renders ("flowing well — 3 days ago, confirmed by 2").
 */

import {
  CONFIDENCE_WINDOWS_DAYS,
  type ObservationStatus,
  type ObservationTag,
} from "./constants";
import { ageInDays } from "./display";
import type { SourceSnapshotItem } from "./snapshot";

export interface ObservationHistoryItem {
  id: string;
  status: ObservationStatus;
  /** Optional details; empty when the hiker just tapped a status. */
  tags: ObservationTag[];
  /** ISO timestamp — when the hiker was at the source. */
  observedAt: string;
  confirmationCount: number;
  /** True when the viewer wrote this observation (can't confirm it). */
  isMine: boolean;
  /** True when the viewer has already confirmed this observation. */
  myConfirmation: boolean;
}

export interface SourceDetail {
  source: SourceSnapshotItem;
  /** Latest first; the first entry is the one a confirmation acts on. */
  observations: ObservationHistoryItem[];
}

/**
 * Has this observation aged out of saying anything at all?
 *
 * Past the `known` window `deriveConfidence` returns `unknown` whatever the
 * observation reads, so the history list renders the row in the neutral gray
 * instead of the status color: the sheet may not print "Statut inconnu" in
 * its header and then re-assert that same status three lines below, in the
 * app's own status palette. Only the presentation moves — the words stay
 * exactly as the hiker reported them, because the list is a record and
 * rewriting it would be revising what someone said.
 *
 * Per observation, not per source. A source whose latest reading is three
 * days old still lists observations from March, and those are just as
 * historic as the ones under a source that has gone quiet entirely.
 */
export function isDecayed(observedAt: string, now: Date = new Date()): boolean {
  return ageInDays(observedAt, now) > CONFIDENCE_WINDOWS_DAYS.known;
}

/**
 * What the sheet's one-tap prompt offers for the latest observation.
 *
 * There is a single prompt above the report form, and this decides which of
 * its states it wears. The rule it encodes: never offer a tap that cannot
 * move the derived confidence — a button that silently does nothing is the
 * false reassurance PRODUCT_PRINCIPLES.md § honesty about uncertainty rules
 * out. So every branch below is gated on the same constants
 * `deriveConfidence` reads; keep them in step.
 *
 * - `confirm`  — inside the `high` window a confirmation is what lifts the
 *                source to high. Cheapest useful contribution, so it leads.
 *                Still asked once the source is already high: the second
 *                voice raises nothing but is real corroboration, and the
 *                sheet prints it ("confirmé par 3 randonneurs").
 * - `confirmed`— the viewer already had their say; nothing left to tap.
 * - `reobserve`— past the `medium` window nothing can raise this observation
 *                any more, but the hiker standing there can say the same
 *                thing again with today's date. That is a *new* observation
 *                (append-only, DOMAIN.md § Observation), not an edit of the
 *                old one, and it lands the source back at `medium`.
 * - `none`     — no honest one-tap action: it is the viewer's own fresh
 *                observation, or so old (`known`) that re-reading it is the
 *                only real answer, which the status grid below already is.
 */
export type SourcePromptState = "confirm" | "confirmed" | "reobserve" | "none";

export function sourcePromptState(
  observation: ObservationHistoryItem,
  now: Date = new Date(),
): SourcePromptState {
  const ageDays = ageInDays(observation.observedAt, now);

  if (ageDays > CONFIDENCE_WINDOWS_DAYS.known) return "none";

  // Too old to lift, recent enough to still be worth restating. Offered to
  // the author too: a fresh observation carries no confirmations, so it can
  // only reach `medium` — there is no self-inflation to guard against.
  if (ageDays > CONFIDENCE_WINDOWS_DAYS.medium) return "reobserve";

  if (observation.isMine) return "none"; // self-inflation; refused server-side
  if (observation.myConfirmation) return "confirmed";
  return ageDays <= CONFIDENCE_WINDOWS_DAYS.high ? "confirm" : "none";
}
