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
      /** True when showing cached data — drives the honesty indicator. */
      stale: boolean;
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
              stale: true,
            },
      );
    });

    fetch("/api/v1/sources")
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
          stale: false,
        });
        void saveSnapshot(snapshot, fetchedAt);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep the last good snapshot on screen but stop pretending it's
        // current (honesty principle).
        setState((prev) =>
          prev.phase === "ready" ? { ...prev, stale: true } : { phase: "error" },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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
        {state.phase === "ready" && state.stale && (
          <p className="rounded-full bg-amber-100/95 px-3 py-1 text-xs font-medium text-amber-900 shadow dark:bg-amber-950/95 dark:text-amber-200">
            {fr.offlineDataAsOf(state.fetchedAt)}
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
