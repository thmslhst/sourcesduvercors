"use client";

/**
 * Client shell of the map page: loads the snapshot (IndexedDB first, then
 * network — offline-first, ARCHITECTURE.md), holds the selection, runs the
 * outbox sync triggers, and code-splits MapLibre (the heavy dependency) out
 * of the initial bundle per the performance budget.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { decaySnapshotItem } from "@/lib/domain/display";
import type { SourcesSnapshot } from "@/lib/domain/snapshot";
import { loadSnapshot, saveSnapshot } from "@/lib/offline/snapshot-cache";
import {
  removeOutboxItem,
  retryOutboxItem,
  subscribeOutbox,
  type OutboxItem,
} from "@/lib/offline/outbox";
import {
  flushOutbox,
  startSyncTriggers,
  type FlushResult,
} from "@/lib/offline/sync";
import { fr } from "@/lib/i18n/fr";
import AboutSheet from "./AboutSheet";
import BlockedSheet from "./BlockedSheet";
import OfflinePanel from "./OfflinePanel";
import SignInSheet from "./SignInSheet";
import SourceSheet from "./SourceSheet";

const SourcesMap = dynamic(() => import("./SourcesMap"), { ssr: false });

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | {
      phase: "ready";
      snapshot: SourcesSnapshot;
      /** When the snapshot was fetched from the network (ISO). */
      fetchedAt: string;
      /**
       * Outcome of the network refresh — drives the honesty indicator.
       * "pending" shows nothing: cached data with a refresh in flight is
       * not "offline", and flashing an offline banner on every load lies.
       */
      refresh: "pending" | "ok" | "failed";
    };

export default function MapShell() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The whole outbox, not a count: the pills and the blocked list are two
  // readings of the same store, so neither can drift from it.
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  // The queue is stuck on a sign-in, which no retry can clear — the pill
  // turns into a way in (lib/offline/sync § blockedBy).
  const [authBlocked, setAuthBlocked] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Slow clock driving offline confidence decay while the app stays open.
  const [decayTick, setDecayTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Re-runs (mutation refresh, retry) keep the previous refresh outcome on
    // screen: a "failed" banner must not flicker off while a retry is in
    // flight, and only a settled fetch may change the verdict.

    // IndexedDB first: instant render, and the only source when offline.
    // Never overwrites data already on screen.
    void loadSnapshot().then((cached) => {
      if (cancelled || !cached) return;
      setState((prev) =>
        prev.phase === "ready"
          ? prev
          : {
              phase: "ready",
              snapshot: cached.snapshot,
              fetchedAt: cached.fetchedAt,
              // The network fetch may already have settled (dead server
              // fails faster than the IDB read) — don't resurrect "pending".
              refresh: prev.phase === "error" ? "failed" : "pending",
            },
      );
    });

    // Bounded wait: past this, show the data-age banner instead of silently
    // rendering old data (honesty principle); the retry triggers take over.
    fetch("/api/v1/sources", { signal: AbortSignal.timeout(15_000) })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SourcesSnapshot>;
      })
      .then((snapshot) => {
        if (cancelled) return;
        const fetchedAt = new Date();
        setState({
          phase: "ready",
          snapshot,
          fetchedAt: fetchedAt.toISOString(),
          refresh: "ok",
        });
        void saveSnapshot(snapshot, fetchedAt);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep the last good snapshot on screen but stop pretending it's
        // current (honesty principle).
        setState((prev) =>
          prev.phase === "ready"
            ? { ...prev, refresh: "failed" }
            : { phase: "error" },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // A failed refresh must not require a manual reload to clear: retry on
  // reconnect, on return to the app, and on a slow interval.
  useEffect(() => {
    if (state.phase !== "ready" || state.refresh !== "failed") return;
    const retry = () => setReloadKey((k) => k + 1);
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(retry, 60_000);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [state]);

  // After a write (observation/reaction/outbox sync) the derived statuses
  // changed server-side: re-fetch without dropping the rendered map data.
  const onMutated = useCallback(() => setReloadKey((k) => k + 1), []);

  // Outbox: pending/blocked badges + replay on reconnect/focus/interval.
  useEffect(() => subscribeOutbox(setOutbox), []);

  // Every flush is read the same way, wherever it was triggered from — the
  // badge must not depend on which one ran. Never touches signInOpen: the
  // interval flush fires every 60 s and must not yank the sheet out from
  // under someone mid-typing.
  const onFlushResult = useCallback(({ blockedBy }: FlushResult) => {
    setAuthBlocked(blockedBy === "auth");
  }, []);

  useEffect(
    () => startSyncTriggers({ onSynced: onMutated, onResult: onFlushResult }),
    [onMutated, onFlushResult],
  );

  const pending = useMemo(
    () => outbox.filter((item) => item.failure === undefined),
    [outbox],
  );
  const blocked = useMemo(
    () => outbox.filter((item) => item.failure !== undefined),
    [outbox],
  );

  // A write that queued behind a missing session: say so now, rather than
  // promising automatic delivery until the next flush proves otherwise (up
  // to a minute later).
  const onNeedsSignIn = useCallback(() => {
    setAuthBlocked(true);
    setSignInOpen(true);
  }, []);

  // Unblocking is worth an immediate attempt — the hiker just asked for it.
  const onRetryBlocked = useCallback(
    (id: string) => {
      void retryOutboxItem(id)
        .then(() => flushOutbox())
        .then((result) => {
          if (result.sent > 0) onMutated();
          onFlushResult(result);
        });
    },
    [onFlushResult, onMutated],
  );
  const onDeleteBlocked = useCallback((id: string) => {
    void removeOutboxItem(id);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(
      () => setDecayTick((t) => t + 1),
      60_000,
    );
    return () => window.clearInterval(interval);
  }, []);

  const sources = useMemo(() => {
    if (state.phase !== "ready") return [];
    // Age-based decay against the current clock — cached "high" from last
    // week must not render as high today (ARCHITECTURE.md § Data flow).
    void decayTick;
    const now = new Date();
    return state.snapshot.sources.map((s) => decaySnapshotItem(s, now));
  }, [state, decayTick]);

  const selected = useMemo(
    () => sources.find((s) => s.id === selectedId) ?? null,
    [sources, selectedId],
  );
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);

  // Dev/e2e hook so tests/tools can drive selection without a canvas click.
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_E2E !== "1"
    ) {
      return;
    }
    (window as unknown as { __selectSource?: typeof onSelect }).__selectSource =
      onSelect;
  }, [onSelect]);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <SourcesMap
        sources={sources}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
        <h1>
          <svg
            viewBox="0 0 501 501"
            role="img"
            aria-label={fr.appName}
            className="h-10 w-10 rounded-full shadow"
          >
            <circle cx="250.5" cy="250.5" r="250.5" fill="#4D794E" />
            <path
              d="M250.5 392.543C185.607 392.543 133 339.936 133 275.043C133 210.149 185.607 374.638 250.5 374.638C315.393 374.638 368 210.149 368 275.043C368 339.936 315.393 392.543 250.5 392.543Z"
              fill="#C4ECFF"
            />
            <path
              d="M249.381 343C198.702 343 157.619 290.635 157.619 226.04C157.619 161.444 198.702 325.177 249.381 325.177C300.06 325.177 341.143 161.444 341.143 226.04C341.143 290.635 300.06 343 249.381 343Z"
              fill="#C4ECFF"
            />
            <path
              d="M250.5 293.762C214.036 293.762 184.476 241.397 184.476 176.802C184.476 112.206 214.036 275.939 250.5 275.939C286.964 275.939 316.524 112.206 316.524 176.802C316.524 241.397 286.964 293.762 250.5 293.762Z"
              fill="#C4ECFF"
            />
            <path
              d="M213.572 172.905C213.572 152.51 235.5 108 250.5 108C265.5 108 287.429 152.51 287.429 172.905C287.429 193.3 270.895 209.833 250.5 209.833C230.105 209.833 213.572 193.3 213.572 172.905Z"
              fill="#C4ECFF"
            />
          </svg>
        </h1>
        {state.phase === "ready" && state.refresh === "failed" && (
          <p className="rounded-full border border-secondary bg-primary px-3 py-1 text-xs font-semibold text-secondary shadow">
            {/* "Hors ligne" only when the browser agrees — an unreachable
                server while online is a different (honest) message. */}
            {navigator.onLine === false
              ? fr.offlineDataAsOf(state.fetchedAt)
              : fr.refreshFailedDataAsOf(state.fetchedAt)}
          </p>
        )}
        {pending.length > 0 &&
          (authBlocked ? (
            // Retrying can't clear a 401 — offer the only thing that can.
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="pointer-events-auto rounded-full border border-secondary bg-primary px-3 py-1 text-xs font-semibold text-secondary underline shadow"
            >
              {fr.pendingNeedSignIn(pending.length)}
            </button>
          ) : (
            <p className="rounded-full border border-secondary/60 bg-primary px-3 py-1 text-xs font-medium text-secondary shadow">
              {fr.pendingContributions(pending.length)}
            </p>
          ))}
        {/* Refused, still here. The pill opens the list rather than offering
            to make it go away — deleting a contribution is the hiker's call
            and needs to be made per item, with the reason in front of them. */}
        {blocked.length > 0 && (
          <button
            type="button"
            onClick={() => setBlockedOpen(true)}
            className="pointer-events-auto rounded-full border border-secondary bg-primary px-3 py-1 text-xs font-semibold text-secondary underline shadow"
          >
            {fr.blockedPill(blocked.length)}
          </button>
        )}
      </div>

      {state.phase === "loading" && (
        <p className="absolute inset-x-0 top-14 z-10 mx-auto w-fit rounded-full border border-secondary/60 bg-primary px-3 py-1.5 text-sm text-secondary shadow">
          {fr.loadingSources}
        </p>
      )}
      {state.phase === "error" && (
        <div className="absolute inset-x-0 top-14 z-10 mx-auto flex w-fit items-center gap-2 rounded-full border border-secondary bg-primary px-3 py-1.5 text-sm text-secondary shadow">
          <span>{fr.loadError}</span>
          <button
            type="button"
            onClick={() => {
              setState({ phase: "loading" });
              setReloadKey((k) => k + 1);
            }}
            className="font-semibold text-secondary underline"
          >
            {fr.retry}
          </button>
        </div>
      )}

      {/* Same 12px inset as the logo cluster and the MapLibre controls. */}
      <div className="absolute bottom-3 left-3 z-10 flex items-end gap-2">
        <OfflinePanel />
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          aria-label={fr.aboutButton}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-secondary/60 bg-primary text-base font-semibold text-secondary shadow"
        >
          i
        </button>
      </div>

      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* Opened both by the blocked-queue pill and by the quiet "se connecter"
          link in the sheet, so it must not be gated on pendingCount. */}
      <SignInSheet
        open={signInOpen}
        pendingCount={pending.length}
        onClose={() => setSignInOpen(false)}
      />

      <BlockedSheet
        open={blockedOpen}
        items={blocked}
        sources={sources}
        onRetry={onRetryBlocked}
        onDelete={onDeleteBlocked}
        onClose={() => setBlockedOpen(false)}
      />

      <SourceSheet
        source={selected}
        onClose={() => setSelectedId(null)}
        onMutated={onMutated}
        onNeedsSignIn={onNeedsSignIn}
      />
    </div>
  );
}
