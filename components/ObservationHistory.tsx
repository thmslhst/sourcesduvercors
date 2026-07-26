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
              <span className="text-neutral-600 dark:text-neutral-400">
                {fr.timeAgo(o.observedAt)} ·{" "}
                {o.isMine ? fr.yourObservation : o.authorName}
              </span>
            </div>
            {o.comment && (
              <p className="mt-0.5 pl-[18px] text-neutral-700 dark:text-neutral-300">
                {o.comment}
              </p>
            )}
            {(o.confirmationCount > 0 || o.disputeCount > 0) && (
              <p className="mt-0.5 pl-[18px] text-xs text-neutral-600 dark:text-neutral-400">
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
                      ? "border-green-700 bg-green-50 text-green-800 dark:border-green-500 dark:bg-green-950 dark:text-green-300"
                      : "border-neutral-300 dark:border-neutral-600"
                  }`}
                >
                  ✓ {fr.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => onReact(o.id, "dispute")}
                  aria-pressed={o.myReaction === "dispute"}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    o.myReaction === "dispute"
                      ? "border-orange-700 bg-orange-50 text-orange-800 dark:border-orange-500 dark:bg-orange-950 dark:text-orange-300"
                      : "border-neutral-300 dark:border-neutral-600"
                  }`}
                >
                  ✕ {fr.dispute}
                </button>
              </div>
            )}
            {i === 0 && reactionError && (
              <p className="mt-1 pl-[18px] text-xs text-red-600 dark:text-red-400">
                {fr.reactionFailed}
              </p>
            )}
            {i === 0 && reactionQueued && (
              <p className="mt-1 pl-[18px] text-xs text-blue-700 dark:text-blue-300">
                {fr.reactionQueued}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
