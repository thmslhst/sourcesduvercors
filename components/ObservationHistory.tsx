"use client";

/**
 * Recent observation list — a record, not a place to act. Everything that
 * can be said about the latest observation is said once, in the prompt above
 * the report form (components/SourcePrompt.tsx); a second, smaller confirm
 * button lived here until August 2026 and only made the same act look
 * inconsistent depending on the observation's age.
 *
 * The exception is retraction, which belongs to a row and not to the source:
 * a mis-tapped "à sec" is otherwise the map's answer for weeks and only an
 * admin could take it back. Confirming it is inline, in two taps, rather
 * than window.confirm.
 */

import { useState } from "react";

import { STATUS_COLORS } from "@/lib/domain/display";
import { isDecayed } from "@/lib/domain/detail";
import type { ObservationHistoryItem } from "@/lib/domain/detail";
import { fr } from "@/lib/i18n/fr";

interface ObservationHistoryProps {
  observations: ObservationHistoryItem[];
  /** Signed-in? The retract link renders only when true. */
  canRetract: boolean;
  onRetract: (observationId: string) => void;
  /** Observation whose retraction failed, if any. */
  retractErrorFor: string | null;
}

export default function ObservationHistory({
  observations,
  canRetract,
  onRetract,
  retractErrorFor,
}: ObservationHistoryProps) {
  const [confirmingRetract, setConfirmingRetract] = useState<string | null>(
    null,
  );

  if (observations.length === 0) return null;

  // One clock for the whole list, so a row cannot be dated against a slightly
  // different "now" than the one that decided whether it still counts.
  const now = new Date();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{fr.recentObservations}</p>
      <ul className="flex flex-col gap-3">
        {observations.map((o) => {
          const decayed = isDecayed(o.observedAt, now);
          return (
            <li key={o.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: decayed
                      ? STATUS_COLORS.unknown
                      : STATUS_COLORS[o.status],
                  }}
                />
                {/* De-emphasis stops at dropping the weight and matching the
                  meta text: this is read at arm's length in full sun, so a
                  historic row still has to be legible. Stacking an opacity
                  on top of the /75 is where that stops being true. */}
                <span className={decayed ? "text-secondary/75" : "font-medium"}>
                  {fr.status[o.status]}
                </span>
                <span className="text-secondary/75">
                  {fr.timeAgo(o.observedAt, now)}
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
              {canRetract && o.isMine && (
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
