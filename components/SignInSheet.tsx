"use client";

/**
 * The escape hatch for a queue blocked on auth. Observations captured
 * offline while signed out replay with a 401 and stay put (lib/offline/sync
 * — "blocked: auth"), which no retry can ever clear: only the hiker can.
 * SignInForm otherwise lives inside SourceSheet, so without this the prompt
 * would be unreachable with no source selected and the queue would wedge.
 *
 * Opening it needs the network anyway (the magic link has to be sent), so
 * this is only ever shown after a flush actually reached the server.
 */

import { fr } from "@/lib/i18n/fr";
import SignInForm from "./SignInForm";

interface SignInSheetProps {
  open: boolean;
  /**
   * Pending items, so the copy can name what is actually waiting. Zero when
   * opened proactively from the sheet's "se connecter" link.
   */
  pendingCount: number;
  onClose: () => void;
}

export default function SignInSheet({
  open,
  pendingCount,
  onClose,
}: SignInSheetProps) {
  if (!open) return null;

  const claiming = pendingCount > 0;
  const title = claiming ? fr.signInToSendTitle : fr.signInTitle;

  return (
    <section
      aria-label={title}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[85dvh] max-w-lg flex-col gap-3 overflow-y-auto rounded-t-2xl border border-b-0 border-secondary bg-primary p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-secondary shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-title text-xl">{title}</h2>
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

      {claiming && (
        <p className="text-sm text-secondary/90">
          {fr.signInToSendIntro(pendingCount)}
        </p>
      )}

      <div className="border-t border-secondary/30 pt-3">
        <SignInForm hideTitle />
      </div>
    </section>
  );
}
