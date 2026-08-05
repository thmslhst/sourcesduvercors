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
 * Is confirming this observation worth offering as the primary action?
 *
 * A confirmation only ever changes the derived confidence inside the `high`
 * window (see `deriveConfidence`) — beyond it, tapping "Confirmer" moves
 * nothing. Leading with a button that does nothing would be exactly the kind
 * of false reassurance PRODUCT_PRINCIPLES.md § honesty about uncertainty
 * rules out, so the CTA is gated on the same constant the derivation uses.
 * Keep the two in step.
 */
export function isConfirmWorthPromoting(
  observation: ObservationHistoryItem,
  now: Date = new Date(),
): boolean {
  if (observation.isMine) return false; // self-inflation; refused server-side
  if (observation.myConfirmation) return false; // already had their say
  return (
    ageInDays(observation.observedAt, now) <= CONFIDENCE_WINDOWS_DAYS.high
  );
}
