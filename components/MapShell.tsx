"use client";

/**
 * Client shell of the map page: fetches the snapshot, holds the selection,
 * and code-splits MapLibre (the heavy dependency) out of the initial bundle
 * per the performance budget (ARCHITECTURE.md).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import type { SourcesSnapshot } from "@/lib/domain/snapshot";
import { fr } from "@/lib/i18n/fr";
import SourceSheet from "./SourceSheet";

const SourcesMap = dynamic(() => import("./SourcesMap"), { ssr: false });

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; snapshot: SourcesSnapshot };

export default function MapShell() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/sources")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SourcesSnapshot>;
      })
      .then((snapshot) => {
        if (!cancelled) setState({ phase: "ready", snapshot });
      })
      .catch(() => {
        // A silent refresh failure keeps the last good snapshot on screen.
        if (!cancelled) {
          setState((prev) => (prev.phase === "ready" ? prev : { phase: "error" }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // After a write (observation/reaction) the derived statuses changed
  // server-side: re-fetch without dropping the rendered map data.
  const onMutated = useCallback(() => setReloadKey((k) => k + 1), []);

  const sources = useMemo(
    () => (state.phase === "ready" ? state.snapshot.sources : []),
    [state],
  );
  const selected = useMemo(
    () => sources.find((s) => s.id === selectedId) ?? null,
    [sources, selectedId],
  );
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);

  // Dev-only hook so tests/tools can drive selection without a canvas click.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
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

      <h1 className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold shadow dark:bg-neutral-900/90">
        {fr.appName}
      </h1>

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

      <SourceSheet
        source={selected}
        onClose={() => setSelectedId(null)}
        onMutated={onMutated}
      />
    </div>
  );
}
