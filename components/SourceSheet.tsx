"use client";

/**
 * Bottom sheet with the details of the selected source: identity, live
 * status + confidence with the underlying facts (honesty principle —
 * DOMAIN.md), observation history, and the contribute flow (report /
 * confirm).
 *
 * Contributing is never gated on a session: the form is the default view for
 * everyone, and a missing session is resolved at send time (the write is
 * queued, then a sign-in is asked for). Hiding it behind sign-in bought no
 * security — the API's 401 is the whole defense — and cost the funnel its
 * cheapest step (PRODUCT_PRINCIPLES § 6).
 */

import { useCallback, useEffect, useState } from "react";

import { useOfflineSession } from "@/lib/offline/session";
import {
  sourcePromptState,
  type ObservationHistoryItem,
  type SourceDetail,
} from "@/lib/domain/detail";
import { STATUS_COLORS } from "@/lib/domain/display";
import type { SourceSnapshotItem } from "@/lib/domain/snapshot";
import { isAuthoredHere } from "@/lib/offline/authored";
import { enqueueOutbox, reactionOutboxKey } from "@/lib/offline/outbox";
import { submitObservation } from "@/lib/offline/submit-observation";
import { fr } from "@/lib/i18n/fr";
import AccountActions from "./AccountActions";
import ObservationForm from "./ObservationForm";
import ObservationHistory from "./ObservationHistory";
import SourcePrompt from "./SourcePrompt";

/**
 * A fast detail call resolves well under this, so the placeholder never
 * flashes for the common case — it only appears when the wait is long
 * enough to be worth acknowledging.
 */
const PLACEHOLDER_DELAY_MS = 400;

interface SourceSheetProps {
  source: SourceSnapshotItem | null;
  onClose: () => void;
  /** Called after any successful write so the map snapshot refreshes. */
  onMutated: () => void;
  /** Open the sign-in prompt — a write was queued that only a session unblocks. */
  onNeedsSignIn: () => void;
}

export default function SourceSheet({
  source,
  onClose,
  onMutated,
  onNeedsSignIn,
}: SourceSheetProps) {
  // Offline-tolerant: falls back to the mirrored session when the
  // get-session call can't reach the server (lib/offline/session.ts).
  const sessionState = useOfflineSession();
  const session = sessionState.status === "signed-in" ? sessionState : null;
  // No session: writes still work, into the outbox — the sign-in is owed at
  // flush time. Offline we know it up front; online the 401 tells us.
  const deferredAuth = sessionState.status !== "signed-in";
  // Offline-only preamble: online, the sign-in prompt at send time explains
  // itself, so the form needs no warning label.
  const offlineNotice = sessionState.status === "unreachable";
  // Keyed by source id so a stale detail (or error) never shows for the
  // newly selected source — no state reset needed on selection change.
  const [detailFor, setDetailFor] = useState<{
    sourceId: string;
    detail: SourceDetail;
  } | null>(null);
  // Source id whose detail call has settled (loaded or failed) — lets the
  // history section show a placeholder while in flight without mistaking
  // "no observations" or "offline" for "still loading".
  const [settledFor, setSettledFor] = useState<string | null>(null);
  // …and the id whose call has been in flight long enough to deserve one.
  const [slowFor, setSlowFor] = useState<string | null>(null);
  // Outcome of the prompt's one tap — confirm and re-observe share the slot
  // because only one of them is ever on screen. Keyed by source id so it
  // can't follow the hiker to the next sheet.
  const [promptOutcomeFor, setPromptOutcomeFor] = useState<{
    sourceId: string;
    outcome: "queued" | "error";
  } | null>(null);
  // Keyed by observation id, not source id — the failure belongs to the row.
  const [retractErrorFor, setRetractErrorFor] = useState<string | null>(null);

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
      })
      .finally(() => {
        setSettledFor(sourceId);
      });
  }, [sourceId]);

  useEffect(() => {
    void fetchDetail();
    // Re-fetch when the session appears: history gains isMine/myConfirmation.
  }, [fetchDetail, sessionUserId]);

  // A source the snapshot has never seen observed has no history coming: the
  // detail call can only answer "no observations", so a placeholder would be
  // a pure height jump. Gate on the fact rather than on the derived `unknown`
  // status — a source whose confidence has decayed to `unknown` still has old
  // observations to list, and those are worth waiting for.
  const expectsHistory = source !== null && source.lastObservedAt !== null;

  const historyPending =
    expectsHistory &&
    sourceId !== null &&
    detailFor?.sourceId !== sourceId &&
    settledFor !== sourceId;

  useEffect(() => {
    if (!historyPending || sourceId === null) return;
    const timer = setTimeout(() => setSlowFor(sourceId), PLACEHOLDER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [historyPending, sourceId]);

  const onConfirm = useCallback(
    async (observationId: string) => {
      if (!sourceId) return;
      setPromptOutcomeFor(null);

      // Outbox with a client UUID (idempotent replay, ARCHITECTURE.md
      // § Write path offline).
      const queueReaction = async (needsSignIn: boolean) => {
        try {
          await enqueueOutbox({
            kind: "reaction",
            // Keyed by the observation: tapping confirm twice replaces the
            // queued reaction rather than stacking another pending
            // contribution.
            id: reactionOutboxKey(observationId),
            reactionId: crypto.randomUUID(),
            enqueuedAt: new Date().toISOString(),
            observationId,
            // Only the sheet knows this, and a blocked confirmation has to
            // be able to say which source it was about.
            sourceId,
          });
          setPromptOutcomeFor({ sourceId, outcome: "queued" });
          if (needsSignIn) onNeedsSignIn();
        } catch {
          setPromptOutcomeFor({ sourceId, outcome: "error" });
        }
      };

      let res: Response;
      try {
        res = await fetch(`/api/v1/observations/${observationId}/confirm`, {
          method: "POST",
        });
      } catch {
        await queueReaction(false);
        return;
      }
      if (res.status === 401) {
        // Same rule as the report form: keep the write, ask for the session.
        await queueReaction(true);
        return;
      }
      if (!res.ok) {
        setPromptOutcomeFor({ sourceId, outcome: "error" });
        return;
      }
      await fetchDetail();
      onMutated();
    },
    [fetchDetail, onMutated, onNeedsSignIn, sourceId],
  );

  /**
   * Past the freshness window a confirmation can no longer lift anything, so
   * the prompt asks for the reading again instead — which is a new
   * observation carrying the old one's status, dated now. Never an edit of
   * the old row: observations are append-only, and the server refuses a
   * backdated one outright rather than redating it.
   *
   * Tags are deliberately not copied. They described what that hiker saw;
   * restating the status is not a claim that "difficile à trouver" still
   * holds, and inventing it on their behalf is exactly the kind of borrowed
   * certainty the honesty principle rules out.
   */
  const onReobserve = useCallback(
    async (observation: ObservationHistoryItem) => {
      if (!sourceId) return;
      setPromptOutcomeFor(null);
      const outcome = await submitObservation(
        {
          id: crypto.randomUUID(),
          sourceId,
          status: observation.status,
          tags: [],
          observedAt: new Date().toISOString(),
        },
        deferredAuth,
      );
      if (outcome === "error") {
        setPromptOutcomeFor({ sourceId, outcome: "error" });
        return;
      }
      if (outcome !== "saved") {
        setPromptOutcomeFor({ sourceId, outcome: "queued" });
        if (outcome === "queuedNeedsSignIn") onNeedsSignIn();
        return;
      }
      await fetchDetail();
      onMutated();
    },
    [deferredAuth, fetchDetail, onMutated, onNeedsSignIn, sourceId],
  );

  /**
   * Retraction needs the network: it corrects server state, and the outbox
   * is for field observations — a queued delete would have to be ordered
   * against a still-pending create, for a case the UI can't even reach
   * (history renders server data, so an outboxed observation isn't listed).
   */
  const onRetract = useCallback(
    async (observationId: string) => {
      setRetractErrorFor(null);
      let res: Response;
      try {
        res = await fetch(`/api/v1/observations/${observationId}`, {
          method: "DELETE",
        });
      } catch {
        setRetractErrorFor(observationId);
        return;
      }
      if (!res.ok) {
        setRetractErrorFor(observationId);
        return;
      }
      await fetchDetail();
      onMutated();
    },
    [fetchDetail, onMutated],
  );

  const onSaved = useCallback(() => {
    void fetchDetail();
    onMutated();
  }, [fetchDetail, onMutated]);

  if (!source) return null;

  const detail = detailFor?.sourceId === source.id ? detailFor.detail : null;
  const loadingObservations = historyPending && slowFor === source.id;
  const promptOutcome =
    promptOutcomeFor?.sourceId === source.id ? promptOutcomeFor.outcome : null;

  // Fresher-than-snapshot facts once the detail call lands.
  const current = detail?.source ?? source;

  // The one place the latest observation can be acted on. `sourcePromptState`
  // owns which tap is honest here — the sheet only decides that a tap needs a
  // resolved session first, and supplies the one fact the server cannot.
  //
  // `isMine` comes from the session, so a signed-out viewer is told `false`
  // for every observation including their own. Offering "Confirmer" there
  // queues a confirmation the server refuses outright (own_observation) as
  // soon as they sign in, which is exactly how a whole queue used to end up
  // unsendable. The device remembers what it filed; that answer holds
  // signed out and offline both.
  const latest = detail?.observations[0] ?? null;
  const promptState =
    sessionState.status === "pending" || !latest
      ? "none"
      : sourcePromptState({
          ...latest,
          isMine: latest.isMine || isAuthoredHere(latest.id),
        });

  // Three answers to "what is known here?", not two. A source that decayed
  // to `unknown` is not the same as one nobody has ever reported: somebody
  // found this one, which is worth saying, and its confirmations are not —
  // they corroborate an observation that no longer supports anything, so
  // printing "confirmé par 2 randonneurs" under a "Confiance inconnue" badge
  // only lends weight the app just withdrew.
  const knowledge =
    current.lastObservedAt === null
      ? fr.noObservationYet
      : current.confidence === "unknown"
        ? fr.staleObservation(fr.timeAgo(current.lastObservedAt))
        : [
            fr.timeAgo(current.lastObservedAt),
            current.confirmationCount > 0 &&
              fr.confirmedBy(current.confirmationCount),
          ]
            .filter(Boolean)
            .join(" · ");

  return (
    <section
      aria-label={source.name ?? fr.unnamedSource}
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[70dvh] max-w-lg flex-col gap-3 overflow-y-auto rounded-t-2xl border border-b-0 border-secondary bg-primary p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-secondary shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-title text-xl">
            {source.name ?? fr.unnamedSource}
          </h2>
          <p className="text-sm text-secondary/75">
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

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[current.status] }}
          />
          <span className="font-medium">{fr.status[current.status]}</span>
          <span className="rounded-full border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary">
            {fr.confidence[current.confidence]}
          </span>
        </div>
        <p className="mt-1 text-sm text-secondary/75">{knowledge}</p>
      </div>

      {loadingObservations ? (
        <div
          role="status"
          aria-label={fr.loadingObservations}
          className="animate-pulse border-t border-secondary/30 pt-3"
        >
          <div className="h-3.5 w-40 rounded bg-secondary/20" />
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-secondary/20" />
            <div className="h-3 w-56 rounded bg-secondary/15" />
          </div>
          <div className="mt-2 ml-[18px] h-3 w-2/3 rounded bg-secondary/10" />
        </div>
      ) : (
        detail &&
        detail.observations.length > 0 && (
          <div className="border-t border-secondary/30 pt-3">
            <ObservationHistory
              observations={detail.observations}
              // Retraction needs the network anyway, so unlike the prompt
              // there is nothing to offer before the session resolves.
              canRetract={sessionState.status !== "pending"}
              onRetract={onRetract}
              retractErrorFor={retractErrorFor}
            />
          </div>
        )
      )}

      <div className="flex flex-col gap-3 border-t border-secondary/30 pt-3">
        {latest && promptState !== "none" && (
          <SourcePrompt
            observation={latest}
            state={promptState}
            onConfirm={() => void onConfirm(latest.id)}
            onReobserve={() => void onReobserve(latest)}
            queued={promptOutcome === "queued"}
            failed={promptOutcome === "error"}
          />
        )}
        {/* The form is the default view for everyone. "pending" alone renders
            nothing — committing to a branch before the session answers is
            what used to flash the sign-in form at signed-in hikers. */}
        {sessionState.status !== "pending" && (
          <>
            {offlineNotice && (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {fr.contributeOfflineTitle}
                </p>
                <p className="text-xs text-secondary/75">
                  {fr.contributeOfflineIntro}
                </p>
              </div>
            )}
            <ObservationForm
              sourceId={source.id}
              onSaved={onSaved}
              deferredAuth={deferredAuth}
              onNeedsSignIn={onNeedsSignIn}
            />
            {/* Signing in is possible right now and sends immediately, so keep
                a way to do it — quiet enough not to compete with the form.
                Pointless offline, where the magic link can't be delivered. */}
            {sessionState.status === "signed-out" && (
              <p className="text-xs text-secondary/75">
                {fr.signInPrompt}{" "}
                <button
                  type="button"
                  onClick={onNeedsSignIn}
                  className="font-semibold text-secondary underline"
                >
                  {fr.signInAction}
                </button>
              </p>
            )}
          </>
        )}
      </div>

      {session && <AccountActions email={session.user.email} />}

      <p className="text-xs text-secondary/75">{fr.potabilityDisclaimer}</p>
    </section>
  );
}
