"use client";

/**
 * Basemap-download control (offline layer 3, ARCHITECTURE.md): a small
 * button over the map that opens a card showing the archive size *before*
 * download (ROADMAP Phase 3), streaming progress, and a delete action.
 */

import { useCallback, useEffect, useState } from "react";

import {
  deleteBasemap,
  downloadBasemap,
  getBasemapState,
} from "@/lib/offline/basemap";
import { fr } from "@/lib/i18n/fr";

type PanelState =
  | { phase: "idle"; downloaded: boolean; sizeBytes: number | null }
  | { phase: "downloading"; pct: number }
  | { phase: "error" };

export default function OfflinePanel() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PanelState | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getBasemapState().then(({ downloaded, sizeBytes }) => {
      if (!cancelled) setState({ phase: "idle", downloaded, sizeBytes });
    });
    return () => {
      cancelled = true;
    };
  }, [open, refreshKey]);

  // Re-runs the effect above (it owns the state write).
  const refresh = useCallback(async () => {
    setRefreshKey((k) => k + 1);
  }, []);

  const onDownload = useCallback(async () => {
    setState({ phase: "downloading", pct: 0 });
    try {
      await downloadBasemap((received, total) => {
        if (total) {
          setState({
            phase: "downloading",
            pct: Math.min(100, Math.round((received / total) * 100)),
          });
        }
      });
      await refresh();
    } catch {
      setState({ phase: "error" });
    }
  }, [refresh]);

  const onDelete = useCallback(async () => {
    await deleteBasemap();
    await refresh();
  }, [refresh]);

  return (
    <div className="absolute bottom-8 left-3 z-10 flex flex-col items-start gap-2">
      {open && (
        <div className="w-64 rounded-xl border border-neutral-200 bg-white/95 p-3 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900/95">
          <p className="font-semibold">{fr.offlineMapTitle}</p>
          {state === null && <p className="mt-1">…</p>}

          {state?.phase === "idle" && state.downloaded && (
            <>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                {fr.offlineMapReady(
                  state.sizeBytes !== null ? fr.megabytes(state.sizeBytes) : "",
                )}
              </p>
              <button
                type="button"
                onClick={() => void onDelete()}
                className="mt-2 text-xs font-semibold text-red-600 underline dark:text-red-400"
              >
                {fr.offlineMapDelete}
              </button>
            </>
          )}

          {state?.phase === "idle" && !state.downloaded && (
            <>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                {state.sizeBytes !== null
                  ? fr.offlineMapIntro(fr.megabytes(state.sizeBytes))
                  : fr.offlineMapNeedsNetwork}
              </p>
              {state.sizeBytes !== null && (
                <button
                  type="button"
                  onClick={() => void onDownload()}
                  className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  {fr.offlineMapDownload(fr.megabytes(state.sizeBytes))}
                </button>
              )}
            </>
          )}

          {state?.phase === "downloading" && (
            <div className="mt-2">
              <p>{fr.offlineMapDownloading(state.pct)}</p>
              <div
                role="progressbar"
                aria-valuenow={state.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
              >
                <div
                  className="h-full bg-blue-600 transition-[width]"
                  style={{ width: `${state.pct}%` }}
                />
              </div>
            </div>
          )}

          {state?.phase === "error" && (
            <>
              <p className="mt-1 text-red-600 dark:text-red-400">
                {fr.offlineMapFailed}
              </p>
              <button
                type="button"
                onClick={() => void onDownload()}
                className="mt-2 text-xs font-semibold underline"
              >
                {fr.retry}
              </button>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium shadow dark:bg-neutral-900/90"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3v10m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {fr.offlineMapButton}
      </button>
    </div>
  );
}
