"use client";

/**
 * Confirm-first CTA, above the report form.
 *
 * Confirming is the cheapest useful contribution (DOMAIN.md § Confirmation)
 * and the only one that can lift a source to high confidence, yet it used to
 * be a small pill under the history list while the four-button status grid
 * took the primary slot. Hoisting it makes confirming two taps: open the
 * sheet, confirm.
 *
 * The grid stays exactly where it is, expanded. Collapsing it behind a
 * disclosure would push reporting to four taps and break the ≤3-tap budget
 * (PRODUCT_PRINCIPLES.md § 4) — this is an addition above it, not a
 * replacement for it.
 *
 * Offline: the confirm goes through the sheet's existing reaction handler,
 * which falls back to the outbox when the network is unreachable.
 */

import type { ObservationHistoryItem } from "@/lib/domain/detail";
import { STATUS_COLORS } from "@/lib/domain/display";
import { fr } from "@/lib/i18n/fr";

interface ConfirmPromptProps {
  /** The latest observation — the one the derived status is computed from. */
  observation: ObservationHistoryItem;
  onConfirm: () => void;
}

export default function ConfirmPrompt({
  observation,
  onConfirm,
}: ConfirmPromptProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-secondary/40 bg-secondary/10 p-3">
      <p className="text-sm font-medium">{fr.confirmPromptTitle}</p>
      {/* Name the claim being confirmed — never a bare "still right?". */}
      <p className="flex items-center gap-2 text-sm text-secondary/90">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[observation.status] }}
        />
        {fr.confirmPromptClaim(
          fr.status[observation.status],
          fr.timeAgo(observation.observedAt),
        )}
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-primary"
      >
        ✓ {fr.confirm}
      </button>
      <p className="text-xs text-secondary/75">{fr.confirmPromptAlternative}</p>
    </div>
  );
}
