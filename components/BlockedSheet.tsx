"use client";

/**
 * What the outbox does with a contribution the server refused.
 *
 * The old answer was a banner reading "1 contribution n’a pas pu être
 * envoyée" whose only control was "Ignorer" — which deleted it. The hiker
 * was told about a loss they could not inspect, could not act on, and had
 * already suffered. This sheet is the replacement: every refused write is
 * listed with what it said, where, when, and why it bounced, and it is
 * still on the device until the hiker deletes it.
 *
 * Retry is offered only where retrying can honestly change the answer.
 * "Trop ancienne" and "votre propre observation" are settled facts, so
 * those rows get the explanation and a delete, not a button that would
 * re-run a refusal (PRODUCT_PRINCIPLES § never a control that does
 * nothing).
 *
 * Offline: reads nothing but IndexedDB and the snapshot already on screen,
 * so it opens and works with zero connectivity. "Réessayer" simply unblocks
 * the item — the sync triggers deliver it whenever the network returns.
 */

import { OBSERVED_AT_MAX_PAST_DAYS } from "@/lib/domain/observation-input";
import { STATUS_COLORS } from "@/lib/domain/display";
import type { SourceSnapshotItem } from "@/lib/domain/snapshot";
import type { OutboxItem } from "@/lib/offline/outbox";
import { fr } from "@/lib/i18n/fr";

interface BlockedSheetProps {
  open: boolean;
  /** Only items carrying a `failure`; the caller filters. */
  items: OutboxItem[];
  /** For naming the source a contribution belongs to. */
  sources: SourceSnapshotItem[];
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** Only a refusal the world could still answer differently. */
function isRetriable(item: OutboxItem): boolean {
  return item.failure?.reason === "rejected";
}

export default function BlockedSheet({
  open,
  items,
  sources,
  onRetry,
  onDelete,
  onClose,
}: BlockedSheetProps) {
  if (!open) return null;

  const nameOf = (sourceId: string | undefined): string => {
    const source = sources.find((s) => s.id === sourceId);
    return source?.name ?? fr.unnamedSource;
  };

  const explain = (item: OutboxItem): string => {
    switch (item.failure?.reason) {
      case "too_old":
        return fr.blockedReason.too_old(OBSERVED_AT_MAX_PAST_DAYS);
      case "own_observation":
        return fr.blockedReason.own_observation;
      case "retired":
        return fr.blockedReason.retired;
      default:
        return fr.blockedReason.rejected;
    }
  };

  return (
    <section
      aria-label={fr.blockedTitle}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[85dvh] max-w-lg flex-col gap-3 overflow-y-auto rounded-t-2xl border border-b-0 border-secondary bg-primary p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-secondary shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-title text-xl">{fr.blockedTitle}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={fr.close}
          className="shrink-0 rounded-full p-2 text-secondary/75 hover:bg-secondary/10"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-secondary/90">{fr.blockedEmpty}</p>
      ) : (
        <>
          <p className="text-sm text-secondary/90">{fr.blockedIntro}</p>

          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1.5 rounded-lg border border-secondary/40 bg-secondary/10 p-3"
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  {item.kind === "observation" && (
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: STATUS_COLORS[item.body.status],
                      }}
                    />
                  )}
                  {item.kind === "observation"
                    ? fr.blockedObservation(
                        fr.status[item.body.status],
                        nameOf(item.body.sourceId),
                      )
                    : fr.blockedReaction(nameOf(item.sourceId))}
                </p>
                <p className="text-xs text-secondary/75">
                  {/* The hiker's own clock: when they were at the source. */}
                  {fr.timeAgo(
                    item.kind === "observation"
                      ? item.body.observedAt
                      : item.enqueuedAt,
                  )}
                </p>
                <p className="text-xs text-secondary/90">{explain(item)}</p>

                <div className="flex items-center gap-3 pt-0.5">
                  {isRetriable(item) && (
                    <button
                      type="button"
                      onClick={() => onRetry(item.id)}
                      className="rounded-full border border-secondary/50 px-3 py-1 text-xs font-semibold text-secondary"
                    >
                      {fr.retry}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="text-xs font-semibold text-secondary underline"
                  >
                    {fr.blockedDelete}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {items.length > 1 && (
            <button
              type="button"
              onClick={() => items.forEach((item) => onDelete(item.id))}
              className="self-start text-xs font-semibold text-secondary underline"
            >
              {fr.blockedDeleteAll}
            </button>
          )}
        </>
      )}
    </section>
  );
}
