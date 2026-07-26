"use client";

/**
 * Bottom sheet with the details of the selected source: identity, live
 * status + confidence with the underlying facts (honesty principle —
 * DOMAIN.md), observation history, and the contribute flow (report /
 * confirm / dispute, behind magic-link sign-in).
 */

import { useCallback, useEffect, useState } from "react";

import { signOut } from "@/lib/auth-client";
import { useOfflineSession } from "@/lib/offline/session";
import type { ReactionType } from "@/lib/domain/constants";
import type { SourceDetail } from "@/lib/domain/detail";
import { STATUS_COLORS } from "@/lib/domain/display";
import type { SourceSnapshotItem } from "@/lib/domain/snapshot";
import { enqueueOutbox } from "@/lib/offline/outbox";
import { fr } from "@/lib/i18n/fr";
import ObservationForm from "./ObservationForm";
import ObservationHistory from "./ObservationHistory";
import SignInForm from "./SignInForm";

interface SourceSheetProps {
  source: SourceSnapshotItem | null;
  onClose: () => void;
  /** Called after any successful write so the map snapshot refreshes. */
  onMutated: () => void;
}

export default function SourceSheet({
  source,
  onClose,
  onMutated,
}: SourceSheetProps) {
  // Offline-tolerant: falls back to the mirrored session when the
  // get-session call can't reach the server (lib/offline/session.ts).
  const session = useOfflineSession();
  // Keyed by source id so a stale detail (or error) never shows for the
  // newly selected source — no state reset needed on selection change.
  const [detailFor, setDetailFor] = useState<{
    sourceId: string;
    detail: SourceDetail;
  } | null>(null);
  const [reactionErrorFor, setReactionErrorFor] = useState<string | null>(null);
  const [reactionQueuedFor, setReactionQueuedFor] = useState<string | null>(
    null,
  );

  const sourceId = source?.id ?? null;
  const sessionUserId = session?.user.id ?? null;

  const fetchDetail = useCallback(() => {
    if (!sourceId) return Promise.resolve();
    return fetch(`/api/v1/sources/${sourceId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SourceDetail>;
      })
      .then((detail) => {
        setDetailFor({ sourceId, detail });
      })
      .catch(() => {
        // Sheet falls back to the snapshot data already on screen.
      });
  }, [sourceId]);

  useEffect(() => {
    void fetchDetail();
    // Re-fetch when the session appears: history gains isMine/myReaction.
  }, [fetchDetail, sessionUserId]);

  const onReact = useCallback(
    async (observationId: string, type: ReactionType) => {
      setReactionErrorFor(null);
      setReactionQueuedFor(null);
      let res: Response;
      try {
        res = await fetch(`/api/v1/observations/${observationId}/${type}`, {
          method: "POST",
        });
      } catch {
        // Network unreachable → outbox with a client UUID (idempotent
        // replay, ARCHITECTURE.md § Write path offline).
        try {
          await enqueueOutbox({
            kind: "reaction",
            id: crypto.randomUUID(),
            enqueuedAt: new Date().toISOString(),
            observationId,
            type,
          });
          setReactionQueuedFor(sourceId);
        } catch {
          setReactionErrorFor(sourceId);
        }
        return;
      }
      if (!res.ok) {
        setReactionErrorFor(sourceId);
        return;
      }
      await fetchDetail();
      onMutated();
    },
    [fetchDetail, onMutated, sourceId],
  );

  const onSaved = useCallback(() => {
    void fetchDetail();
    onMutated();
  }, [fetchDetail, onMutated]);

  if (!source) return null;

  const detail = detailFor?.sourceId === source.id ? detailFor.detail : null;
  const reactionError = reactionErrorFor === source.id;
  const reactionQueued = reactionQueuedFor === source.id;

  // Fresher-than-snapshot facts once the detail call lands.
  const current = detail?.source ?? source;

  const facts = [
    current.lastObservedAt !== null && fr.timeAgo(current.lastObservedAt),
    current.confirmationCount > 0 && fr.confirmedBy(current.confirmationCount),
  ].filter(Boolean);

  return (
    <section
      aria-label={source.name ?? fr.unnamedSource}
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[70dvh] max-w-lg flex-col gap-3 overflow-y-auto rounded-t-2xl border border-b-0 border-neutral-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] dark:border-neutral-700 dark:bg-neutral-900"
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

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[current.status] }}
          />
          <span className="font-medium">{fr.status[current.status]}</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {fr.confidence[current.confidence]}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {facts.length > 0 ? facts.join(" · ") : fr.noObservationYet}
        </p>
      </div>

      {source.description && (
        <p className="border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
          {source.description}
        </p>
      )}

      {detail && detail.observations.length > 0 && (
        <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
          <ObservationHistory
            observations={detail.observations}
            canReact={session !== null && session !== undefined}
            onReact={onReact}
            reactionError={reactionError}
            reactionQueued={reactionQueued}
          />
        </div>
      )}

      <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
        {session ? (
          <ObservationForm sourceId={source.id} onSaved={onSaved} />
        ) : (
          <SignInForm />
        )}
      </div>

      {session && (
        <p className="text-xs text-neutral-500">
          {fr.signedInAs(session.user.name || session.user.email)}{" "}
          <button
            type="button"
            onClick={() => void signOut()}
            className="font-semibold underline"
          >
            {fr.signOut}
          </button>
        </p>
      )}

      <p className="text-xs text-neutral-500">{fr.potabilityDisclaimer}</p>
    </section>
  );
}
