/**
 * Explicit download of the Vercors PMTiles basemap — offline layer 3
 * (ARCHITECTURE.md). The archive is stored whole in Cache Storage from the
 * window side; the service worker (public/sw.js) answers MapLibre's Range
 * requests by slicing it. Cache/path names must match sw.js.
 */

export const BASEMAP_PATH = "/basemap/vercors.pmtiles";
const BASEMAP_CACHE = "sdv-basemap-v1";

export interface BasemapState {
  downloaded: boolean;
  /** Archive size in bytes; null when offline and not yet downloaded. */
  sizeBytes: number | null;
}

function cachesAvailable(): boolean {
  return typeof caches !== "undefined";
}

export async function getBasemapState(): Promise<BasemapState> {
  if (!cachesAvailable()) return { downloaded: false, sizeBytes: null };
  try {
    const cache = await caches.open(BASEMAP_CACHE);
    const cached = await cache.match(BASEMAP_PATH);
    if (cached) {
      const blob = await cached.blob();
      return { downloaded: true, sizeBytes: blob.size };
    }
  } catch {
    // fall through to the network probe
  }
  // Size shown before download (ROADMAP Phase 3): a HEAD costs nothing.
  try {
    const res = await fetch(BASEMAP_PATH, { method: "HEAD" });
    const length = res.headers.get("content-length");
    return {
      downloaded: false,
      sizeBytes: res.ok && length ? Number(length) : null,
    };
  } catch {
    return { downloaded: false, sizeBytes: null };
  }
}

/**
 * Stream the archive into Cache Storage, reporting progress. Throws on
 * network failure — the caller owns the error UI.
 */
export async function downloadBasemap(
  onProgress: (receivedBytes: number, totalBytes: number | null) => void,
): Promise<void> {
  const res = await fetch(BASEMAP_PATH, { cache: "no-store" });
  if (!res.ok || !res.body) {
    throw new Error(`basemap download failed: HTTP ${res.status}`);
  }
  const lengthHeader = res.headers.get("content-length");
  const total = lengthHeader ? Number(lengthHeader) : null;

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(received, total);
  }

  const blob = new Blob(chunks, { type: "application/octet-stream" });
  const cache = await caches.open(BASEMAP_CACHE);
  await cache.put(
    BASEMAP_PATH,
    new Response(blob, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(blob.size),
      },
    }),
  );
}

export async function deleteBasemap(): Promise<void> {
  if (!cachesAvailable()) return;
  const cache = await caches.open(BASEMAP_CACHE);
  await cache.delete(BASEMAP_PATH);
}
