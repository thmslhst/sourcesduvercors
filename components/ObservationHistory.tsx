"use client";

/**
 * Recent observation list. Confirm / dispute only apply to the latest
 * observation — that is the one the derived status is computed from
 * (DOMAIN.md § Source display state).
 */

import type { ReactionType } from "@/lib/domain/constants";
import { STATUS_COLORS } from "@/lib/domain/display";
import type { ObservationHistoryItem } from "@/lib/domain/detail";
import { fr } from "@/lib/i18n/fr";

interface ObservationHistoryProps {
  observations: ObservationHistoryItem[];
  /** Signed-in? Reaction buttons render only when true. */
  canReact: boolean;
  onReact: (observationId: string, type: ReactionType) => void;
  reactionError: boolean;
  /** True when the reaction went to the offline outbox instead of the API. */
  reactionQueued: boolean;
}

export default function ObservationHistory({
  observations,
  canReact,
  onReact,
  reactionError,
  reactionQueued,
}: ObservationHistoryProps) {
  if (observations.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{fr.recentObservations}</p>
      <ul className="flex flex-col gap-3">
        {observations.map((o, i) => (
          <li key={o.id} className="text-sm">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[o.status] }}
              />
              <span className="font-medium">{fr.status[o.status]}</span>
              <span className="text-secondary/75">
                {fr.timeAgo(o.observedAt)} ·{" "}
                {o.isMine ? fr.yourObservation : o.authorName}
              </span>
            </div>
            {o.comment && (
              <p className="mt-0.5 pl-[18px] text-secondary/90">{o.comment}</p>
            )}
            {(o.confirmationCount > 0 || o.disputeCount > 0) && (
              <p className="mt-0.5 pl-[18px] text-xs text-secondary/75">
                {[
                  o.confirmationCount > 0 &&
                    fr.confirmedBy(o.confirmationCount),
                  o.disputeCount > 0 && fr.disputedBy(o.disputeCount),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {i === 0 && canReact && !o.isMine && (
              <div className="mt-1.5 flex gap-2 pl-[18px]">
                <button
                  type="button"
                  onClick={() => onReact(o.id, "confirm")}
                  aria-pressed={o.myReaction === "confirm"}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    o.myReaction === "confirm"
                      ? "border-secondary bg-secondary text-primary"
                      : "border-secondary/50 text-secondary"
                  }`}
                >
                  ✓ {fr.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => onReact(o.id, "dispute")}
                  aria-pressed={o.myReaction === "dispute"}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    // Outlined-and-filled rather than solid, so an active
                    // dispute never reads as an active confirm.
                    o.myReaction === "dispute"
                      ? "border-secondary bg-secondary/25 text-secondary"
                      : "border-secondary/50 text-secondary"
                  }`}
                >
                  ✕ {fr.dispute}
                </button>
              </div>
            )}
            {i === 0 && reactionError && (
              <p className="mt-1 pl-[18px] text-xs font-medium text-red-200">
                {fr.reactionFailed}
              </p>
            )}
            {i === 0 && reactionQueued && (
              <p className="mt-1 pl-[18px] text-xs text-secondary/80">
                {fr.reactionQueued}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
