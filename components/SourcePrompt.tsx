"use client";

/**
 * The sheet's one-tap prompt, above the report form.
 *
 * Restating the latest observation is the cheapest useful contribution
 * (DOMAIN.md § Confirmation) and the only one that can lift a source to high
 * confidence, yet it used to be a small pill under the history list while the
 * four-button status grid took the primary slot. Hoisting it makes the whole
 * contribution two taps: open the sheet, tap.
 *
 * It is deliberately one component with several states rather than a card
 * here and a pill there: the same act — "yes, that is what I see" — should
 * not change shape and weight depending on how old the observation is. What
 * changes is what the tap can honestly achieve, which `sourcePromptState`
 * decides: inside the week it files a confirmation, past it a fresh
 * observation carrying the same status. Only the wording of the ask moves;
 * the card never explains the difference, because the hiker is answering the
 * same question either way and a button that needs a paragraph of reasoning
 * beneath it is a button that reads as useless.
 *
 * The grid stays exactly where it is, expanded. Collapsing it behind a
 * disclosure would push reporting to four taps and break the ≤3-tap budget
 * (PRODUCT_PRINCIPLES.md § 4) — this is an addition above it, not a
 * replacement for it.
 *
 * Offline: both actions go through the sheet's handlers, which fall back to
 * the outbox when the network is unreachable.
 */

import type {
  ObservationHistoryItem,
  SourcePromptState,
} from "@/lib/domain/detail";
import { STATUS_COLORS } from "@/lib/domain/display";
import { fr } from "@/lib/i18n/fr";

interface SourcePromptProps {
  /** The latest observation — the one the derived status is computed from. */
  observation: ObservationHistoryItem;
  /** Never "none": the sheet renders nothing at all in that case. */
  state: Exclude<SourcePromptState, "none">;
  onConfirm: () => void;
  onReobserve: () => void;
  /** The tap went to the outbox instead of the API. */
  queued: boolean;
  failed: boolean;
}

export default function SourcePrompt({
  observation,
  state,
  onConfirm,
  onReobserve,
  queued,
  failed,
}: SourcePromptProps) {
  const reobserve = state === "reobserve";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-secondary/40 bg-secondary/10 p-3">
      <p className="text-sm font-medium">
        {reobserve ? fr.reobserveTitle : fr.sourcePromptTitle}
      </p>
      {/* Name the claim being restated — never a bare "still right?". */}
      <p className="flex items-center gap-2 text-sm text-secondary/90">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[observation.status] }}
        />
        {fr.sourcePromptClaim(
          fr.status[observation.status],
          fr.timeAgo(observation.observedAt),
        )}
      </p>

      {state === "confirmed" ? (
        <p className="text-sm font-semibold">✓ {fr.sourcePromptConfirmed}</p>
      ) : (
        <button
          type="button"
          onClick={reobserve ? onReobserve : onConfirm}
          className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-primary"
        >
          ✓ {reobserve ? fr.reobserve : fr.confirm}
        </button>
      )}

      <p className="text-xs text-secondary/75">{fr.sourcePromptAlternative}</p>

      {/* Offline-first: a tap that silently vanished into the outbox is the
          one outcome the sheet may never leave unsaid. */}
      {queued && (
        <p className="text-xs text-secondary/80">{fr.sourcePromptQueued}</p>
      )}
      {failed && (
        <p className="text-xs font-medium text-red-200">
          {fr.sourcePromptFailed}
        </p>
      )}
    </div>
  );
}
