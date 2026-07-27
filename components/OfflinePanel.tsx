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

  // On mount too (not just on open): the toggle button shows whether the
  // basemap is already stored, so the user knows without opening the card.
  useEffect(() => {
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

  // The size probe fails without network; re-probe when connectivity returns
  // so "Connexion requise" doesn't outlive the outage.
  useEffect(() => {
    const onOnline = () => setRefreshKey((k) => k + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
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
    // Positioning is the caller's business: the button sits in the shared
    // bottom-left cluster, and the card floats above it.
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-secondary bg-primary p-3 text-sm text-secondary shadow-lg">
          <p className="font-semibold">{fr.offlineMapTitle}</p>
          {state === null && <p className="mt-1">…</p>}

          {state?.phase === "idle" && state.downloaded && (
            <>
              <p className="mt-1 text-secondary/75">
                {fr.offlineMapReady(
                  state.sizeBytes !== null ? fr.megabytes(state.sizeBytes) : "",
                )}
              </p>
              <button
                type="button"
                onClick={() => void onDelete()}
                className="mt-2 text-xs font-semibold text-secondary underline"
              >
                {fr.offlineMapDelete}
              </button>
            </>
          )}

          {state?.phase === "idle" && !state.downloaded && (
            <>
              {/* "Connexion requise" only when the browser is actually
                  offline; a failed size probe while online still gets a
                  download button — the download itself needs no size. */}
              <p className="mt-1 text-secondary/75">
                {state.sizeBytes !== null
                  ? fr.offlineMapIntro(fr.megabytes(state.sizeBytes))
                  : navigator.onLine === false
                    ? fr.offlineMapNeedsNetwork
                    : fr.offlineMapIntroNoSize}
              </p>
              {(state.sizeBytes !== null || navigator.onLine !== false) && (
                <button
                  type="button"
                  onClick={() => void onDownload()}
                  className="mt-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-semibold text-primary"
                >
                  {state.sizeBytes !== null
                    ? fr.offlineMapDownload(fr.megabytes(state.sizeBytes))
                    : fr.offlineMapDownloadNoSize}
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
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary/25"
              >
                <div
                  className="h-full bg-secondary transition-[width]"
                  style={{ width: `${state.pct}%` }}
                />
              </div>
            </div>
          )}

          {state?.phase === "error" && (
            <>
              <p className="mt-1 font-medium text-red-200">
                {fr.offlineMapFailed}
              </p>
              <button
                type="button"
                onClick={() => void onDownload()}
                className="mt-2 text-xs font-semibold text-secondary underline"
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
        aria-label={fr.offlineMapButton}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-secondary/60 bg-primary text-secondary shadow"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
          <path d="M9 3v16M15 5v16" />
        </svg>
        {/* The label is gone, so "already downloaded" needs its own mark. */}
        {state?.phase === "idle" && state.downloaded && (
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-primary"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </button>
    </div>
  );
}
