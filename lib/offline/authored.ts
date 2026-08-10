"use client";

/**
 * Observations this device filed.
 *
 * `GET /api/v1/sources/:id` answers `isMine` from the session, so a
 * signed-out viewer is told `false` for every observation — including the
 * ones they wrote an hour ago. The sheet then offers "Confirmer" on the
 * hiker's own reading, the tap is queued behind the missing session, and
 * the replay is refused with `own_observation` the moment they sign in.
 * That is the failure that made a whole queue look unsendable.
 *
 * The device is the only thing that still knows, so it remembers: the ids
 * it submitted, mirrored in localStorage so they survive sign-out, reload
 * and a flat battery. It is a heuristic — a second hiker borrowing the
 * phone loses one confirmation offer — and it errs the safe way, only ever
 * *withholding* a tap the server would have refused anyway.
 *
 * Not a source of truth for anything published: it decides which prompt to
 * show, never what the map says.
 */

const KEY = "sdv-authored-observations";
/** Bounded: the prompt only ever asks about a source's latest observation. */
const MAX = 200;

/**
 * Read once, then kept in step by `rememberAuthored`. Components read this
 * during render, so it must not be an async call — and on the server it
 * simply stays empty, which is correct: the sheet renders nothing until a
 * source is selected, which only ever happens client-side.
 */
let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    cache = new Set(
      Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [],
    );
  } catch {
    cache = new Set();
  }
  return cache;
}

/** Record an observation this device submitted — sent or merely queued. */
export function rememberAuthored(observationId: string): void {
  const ids = load();
  ids.add(observationId);
  // Oldest out first; the prompt never asks about an observation this old.
  while (ids.size > MAX) {
    const oldest = ids.values().next().value;
    if (oldest === undefined) break;
    ids.delete(oldest);
  }
  cache = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // Storage full or unavailable — the in-memory set still covers this
    // session, and the server's own refusal remains the real guard.
  }
}

/** Did this device write that observation? */
export function isAuthoredHere(observationId: string): boolean {
  return load().has(observationId);
}

/** Test seam — drops the in-memory copy so the next read hits storage. */
export function resetAuthoredCache(): void {
  cache = null;
}
