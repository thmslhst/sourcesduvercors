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
import { subscribeOutbox } from "@/lib/offline/outbox";
import { startSyncTriggers } from "@/lib/offline/sync";
import { fr } from "@/lib/i18n/fr";
import OfflinePanel from "./OfflinePanel";
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
  const [pendingCount, setPendingCount] = useState(0);
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

  // Outbox: pending-count badge + replay on reconnect/focus/interval.
  useEffect(() => subscribeOutbox(setPendingCount), []);
  useEffect(() => startSyncTriggers(onMutated), [onMutated]);

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
        <h1 className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold shadow dark:bg-neutral-900/90">
          {fr.appName}
        </h1>
        {state.phase === "ready" && state.refresh === "failed" && (
          <p className="rounded-full bg-amber-100/95 px-3 py-1 text-xs font-medium text-amber-900 shadow dark:bg-amber-950/95 dark:text-amber-200">
            {/* "Hors ligne" only when the browser agrees — an unreachable
                server while online is a different (honest) message. */}
            {navigator.onLine === false
              ? fr.offlineDataAsOf(state.fetchedAt)
              : fr.refreshFailedDataAsOf(state.fetchedAt)}
          </p>
        )}
        {pendingCount > 0 && (
          <p className="rounded-full bg-blue-100/95 px-3 py-1 text-xs font-medium text-blue-900 shadow dark:bg-blue-950/95 dark:text-blue-200">
            {fr.pendingContributions(pendingCount)}
          </p>
        )}
      </div>

      {state.phase === "loading" && (
        <p className="absolute inset-x-0 top-14 z-10 mx-auto w-fit rounded-full bg-white/90 px-3 py-1.5 text-sm shadow dark:bg-neutral-900/90">
          {fr.loadingSources}
        </p>
      )}
      {state.phase === "error" && (
        <div className="absolute inset-x-0 top-14 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-sm shadow dark:bg-neutral-900/95">
          <span>{fr.loadError}</span>
          <button
            type="button"
            onClick={() => {
              setState({ phase: "loading" });
              setReloadKey((k) => k + 1);
            }}
            className="font-semibold text-blue-600 dark:text-blue-400"
          >
            {fr.retry}
          </button>
        </div>
      )}

      <OfflinePanel />

      <SourceSheet
        source={selected}
        onClose={() => setSelectedId(null)}
        onMutated={onMutated}
      />
    </div>
  );
}
