"use client";

/**
 * Recent observation list. A confirmation only applies to the latest
 * observation — that is the one the derived status is computed from
 * (DOMAIN.md § Source display state).
 *
 * Your own entries can be retracted: a mis-tapped "à sec" is otherwise the
 * map's answer for weeks and only an admin could take it back. Confirming
 * is inline, in two taps, rather than window.confirm.
 */

import { useState } from "react";

import { STATUS_COLORS } from "@/lib/domain/display";
import type { ObservationHistoryItem } from "@/lib/domain/detail";
import { fr } from "@/lib/i18n/fr";

interface ObservationHistoryProps {
  observations: ObservationHistoryItem[];
  /** Signed-in? The confirm button renders only when true. */
  canReact: boolean;
  onReact: (observationId: string) => void;
  reactionError: boolean;
  /** True when the confirmation went to the offline outbox instead of the API. */
  reactionQueued: boolean;
  onRetract: (observationId: string) => void;
  /** Observation whose retraction failed, if any. */
  retractErrorFor: string | null;
  /**
   * Observation whose confirm button is shown above the report form
   * (ConfirmPrompt) — suppressed here so the action isn't offered twice.
   * Confirming is now the only reaction, so this hides the row outright:
   * when the source has changed, the useful contribution is a fresh
   * observation, and the status grid below the prompt already is that path.
   */
  hoistedConfirmFor: string | null;
}

export default function ObservationHistory({
  observations,
  canReact,
  onReact,
  reactionError,
  reactionQueued,
  onRetract,
  retractErrorFor,
  hoistedConfirmFor,
}: ObservationHistoryProps) {
  const [confirmingRetract, setConfirmingRetract] = useState<string | null>(
    null,
  );

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
                {fr.timeAgo(o.observedAt)}
                {o.isMine && <> · {fr.yourObservation}</>}
              </span>
            </div>
            {o.tags.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1.5 pl-[18px]">
                {o.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-secondary/40 px-2 py-0.5 text-xs text-secondary/90"
                  >
                    {fr.tag[t]}
                  </li>
                ))}
              </ul>
            )}
            {o.confirmationCount > 0 && (
              <p className="mt-0.5 pl-[18px] text-xs text-secondary/75">
                {fr.confirmedBy(o.confirmationCount)}
              </p>
            )}
            {i === 0 && canReact && !o.isMine && hoistedConfirmFor !== o.id && (
              <div className="mt-1.5 pl-[18px]">
                <button
                  type="button"
                  onClick={() => onReact(o.id)}
                  aria-pressed={o.myConfirmation}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    o.myConfirmation
                      ? "border-secondary bg-secondary text-primary"
                      : "border-secondary/50 text-secondary"
                  }`}
                >
                  ✓ {fr.confirm}
                </button>
              </div>
            )}
            {canReact && o.isMine && (
              <div className="mt-1.5 pl-[18px] text-xs">
                {confirmingRetract === o.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-secondary/75">
                      {fr.retractConfirmQuestion}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingRetract(null);
                        onRetract(o.id);
                      }}
                      className="rounded-full border border-secondary/50 px-3 py-1 font-semibold text-secondary"
                    >
                      {fr.retractConfirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingRetract(null)}
                      className="underline text-secondary/75"
                    >
                      {fr.cancel}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingRetract(o.id)}
                    className="underline text-secondary/75"
                  >
                    {fr.retract}
                  </button>
                )}
              </div>
            )}
            {retractErrorFor === o.id && (
              <p className="mt-1 pl-[18px] text-xs font-medium text-red-200">
                {fr.retractFailed}
              </p>
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
