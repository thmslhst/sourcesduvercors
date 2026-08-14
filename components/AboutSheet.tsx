"use client";

/**
 * "À propos" card: what the app is for, how to use it, who makes it, and
 * the ODbL credit that DATA_SOURCES.md requires on an about page (the map
 * corner carries the short form).
 *
 * Offline: entirely static — strings from the catalog and a precached
 * wordmark (public/sw.js), so it opens with zero connectivity. The outbound
 * links (GitHub, the Vercors park page, OpenStreetMap) and the mailto: are
 * the only parts that need a network, and they degrade to dead links rather
 * than breaking the card.
 */

import { fr } from "@/lib/i18n/fr";

const REPO_URL = "https://github.com/thmslhst/sourcesduvercors";
const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
const CONTACT_EMAIL = "info@sourcesduvercors.fr";
const PARK_SOURCES_URL = "https://www.parc-du-vercors.fr/info-sources";

interface AboutSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutSheet({ open, onClose }: AboutSheetProps) {
  if (!open) return null;

  return (
    <section
      aria-label={fr.aboutButton}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[85dvh] max-w-lg flex-col gap-4 overflow-y-auto rounded-t-2xl border border-b-0 border-secondary bg-primary p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-secondary shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
    >
      <div className="relative">
        {/* The wordmark carries the app name, so the heading is the image
            itself rather than a duplicate line of text. */}
        <h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-big.svg"
            alt={fr.appName}
            width={785}
            height={421}
            className="mx-auto h-auto w-44"
          />
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={fr.close}
          className="absolute right-0 top-0 rounded-full p-2 text-secondary/75 hover:bg-secondary/10"
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

      <section className="border-t border-secondary/30 pt-3">
        <h3 className="text-sm font-semibold">{fr.aboutForWhoTitle}</h3>
        <p className="mt-1 text-sm text-secondary/90">{fr.aboutForWho}</p>
      </section>

      <section className="border-t border-secondary/30 pt-3">
        <h3 className="text-sm font-semibold">{fr.aboutHowTitle}</h3>
        <ol className="mt-2 flex flex-col gap-2">
          {fr.aboutHowSteps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-secondary/90">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-secondary/50 text-xs font-semibold text-secondary"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-secondary/30 pt-3">
        <h3 className="text-sm font-semibold">{fr.aboutParticipateTitle}</h3>
        <p className="mt-1 text-sm text-secondary/90">{fr.aboutParticipate}</p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
            />
          </svg>
          {fr.aboutRepoLink}
        </a>
        <p className="mt-2 text-sm text-secondary/90">{fr.aboutAuthor}</p>
      </section>

      <section className="border-t border-secondary/30 pt-3">
        <h3 className="text-sm font-semibold">{fr.aboutMoreTitle}</h3>
        <p className="mt-1 text-sm text-secondary/90">{fr.aboutContact}</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-1 inline-block text-sm font-semibold text-secondary underline"
        >
          {CONTACT_EMAIL}
        </a>
        <p className="mt-3 text-sm text-secondary/90">{fr.aboutPark}</p>
        <a
          href={PARK_SOURCES_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm font-semibold text-secondary underline"
        >
          {fr.aboutParkLink}
        </a>
      </section>

      <section className="border-t border-secondary/30 pt-3">
        <h3 className="text-sm font-semibold">{fr.aboutPrivacyTitle}</h3>
        <div className="mt-1 flex flex-col gap-2">
          {fr.aboutPrivacyPoints.map((point, i) => (
            <p key={i} className="text-sm text-secondary/90">
              {point}
            </p>
          ))}
        </div>
      </section>

      <section className="border-t border-secondary/30 pt-3">
        <h3 className="text-sm font-semibold">{fr.aboutDataTitle}</h3>
        <p className="mt-1 text-xs text-secondary/75">{fr.aboutData}</p>
        <a
          href={OSM_COPYRIGHT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs font-semibold text-secondary underline"
        >
          {fr.aboutOsmLink}
        </a>
      </section>

      <p className="text-xs text-secondary/75">{fr.potabilityDisclaimer}</p>
    </section>
  );
}
