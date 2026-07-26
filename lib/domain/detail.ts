/**
 * Shape of the `GET /api/v1/sources/:id` payload: source + derived status
 * (same item as the snapshot) plus recent observation history — what the
 * detail sheet renders ("flowing well — 3 days ago, confirmed by 2").
 */

import type { ObservationStatus, ReactionType } from "./constants";
import type { SourceSnapshotItem } from "./snapshot";

export interface ObservationHistoryItem {
  id: string;
  status: ObservationStatus;
  comment: string | null;
  /** ISO timestamp — when the hiker was at the source. */
  observedAt: string;
  authorName: string;
  confirmationCount: number;
  disputeCount: number;
  /** True when the viewer wrote this observation (can't react to it). */
  isMine: boolean;
  /** The viewer's own reaction, if any. */
  myReaction: ReactionType | null;
}

export interface SourceDetail {
  source: SourceSnapshotItem;
  /** Latest first; the first entry is the one confirm/dispute act on. */
  observations: ObservationHistoryItem[];
}
