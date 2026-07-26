"use client";

/**
 * Bottom sheet with the details of the selected source: name, type,
 * elevation, description, and the status line (placeholder until Phase 2
 * brings real observations).
 */

import { STATUS_COLORS } from "@/lib/domain/display";
import type { SourceSnapshotItem } from "@/lib/domain/snapshot";
import { fr } from "@/lib/i18n/fr";

interface SourceSheetProps {
  source: SourceSnapshotItem | null;
  onClose: () => void;
}

export default function SourceSheet({ source, onClose }: SourceSheetProps) {
  if (!source) return null;

  return (
    <section
      aria-label={source.name ?? fr.unnamedSource}
      className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg rounded-t-2xl border border-b-0 border-neutral-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">
            {source.name ?? fr.unnamedSource}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {fr.sourceType[source.type]}
            {source.elevationM !== null && (
              <> · {fr.elevation(source.elevationM)}</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={fr.close}
          className="shrink-0 rounded-full p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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

      <div className="mt-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[source.status] }}
        />
        <span className="font-medium">{fr.status[source.status]}</span>
      </div>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {fr.noObservationYet}
      </p>

      {source.description && (
        <p className="mt-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
          {source.description}
        </p>
      )}

      <p className="mt-3 text-xs text-neutral-500">
        {fr.potabilityDisclaimer}
      </p>
    </section>
  );
}
