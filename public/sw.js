/**
 * Service worker — offline layers 1 (app shell) and 3 (map tiles) of
 * ARCHITECTURE.md. Layer 2 (source data) lives in IndexedDB, owned by the
 * page, so /api/* is deliberately NOT cached here.
 *
 * Plain JS, no build step: Next hashes its chunk URLs, so the install step
 * discovers the app-shell assets by parsing the served HTML instead of a
 * build-time manifest.
 */

const VERSION = "v1";
const SHELL_CACHE = `sdv-shell-${VERSION}`;
/**
 * The explicitly downloaded PMTiles archive. Unversioned on purpose: a SW
 * update must never silently discard a 40 MB download. Written by
 * lib/offline/basemap.ts (window side) — keep the names in sync.
 */
const BASEMAP_CACHE = "sdv-basemap-v1";
const BASEMAP_PATH = "/basemap/vercors.pmtiles";

/** Basemap fonts + sprites (MapLibre style assets). */
const STATIC_HOSTS = ["protomaps.github.io"];

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("sdv-shell-") && n !== SHELL_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const res = await fetch("/", { cache: "no-store" });
  if (!res.ok) throw new Error(`shell fetch failed: ${res.status}`);
  const html = await res.clone().text();
  await cache.put("/", res);

  // Hashed Next assets referenced by the page (scripts + stylesheets).
  const assets = new Set([
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
  ]);
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s>\\]+/g)) {
    assets.add(m[0]);
  }
  await Promise.allSettled([...assets].map((path) => cache.add(path)));

  // Fonts are referenced from inside the CSS, one level deeper.
  const cssPaths = [...assets].filter((p) => p.endsWith(".css"));
  const media = new Set();
  for (const path of cssPaths) {
    const cached = await cache.match(path);
    if (!cached) continue;
    const css = await cached.text();
    for (const m of css.matchAll(/\/_next\/static\/media\/[^)"'\s]+/g)) {
      media.add(m[0]);
    }
  }
  await Promise.allSettled([...media].map((path) => cache.add(path)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // PMTiles archive: range-served from the downloaded copy when present.
  if (url.origin === self.location.origin && url.pathname === BASEMAP_PATH) {
    event.respondWith(serveBasemap(req));
    return;
  }

  // API is network-only: offline data comes from IndexedDB, not stale HTTP.
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(req));
    return;
  }

  const isShellAsset =
    (url.origin === self.location.origin &&
      (url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/icons/") ||
        url.pathname === "/manifest.webmanifest")) ||
    STATIC_HOSTS.includes(url.hostname);
  if (isShellAsset) {
    event.respondWith(cacheFirst(req));
  }
});

/** Fresh HTML when online; the cached shell when not. */
async function navigationNetworkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    // Single-page app: every navigation serves the same shell, cache it as "/".
    if (res.ok) await cache.put("/", res.clone());
    return res;
  } catch {
    const cached = await cache.match("/");
    return cached ?? Response.error();
  }
}

/** Hashed/immutable assets: cache wins, network fills gaps. */
async function cacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

/**
 * MapLibre/pmtiles reads the archive with HTTP Range requests, but the Cache
 * API only stores whole responses — so slice the downloaded archive here.
 * Blob.slice is lazy: no 40 MB copies per tile.
 */
async function serveBasemap(req) {
  const cache = await caches.open(BASEMAP_CACHE);
  const full = await cache.match(BASEMAP_PATH);
  if (!full) return fetch(req);

  const range = req.headers.get("range");
  const blob = await full.blob();
  if (!range) {
    return new Response(blob, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(blob.size),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const m = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!m) return new Response(null, { status: 416 });
  const start = Number(m[1]);
  const end = m[2] === "" ? blob.size - 1 : Math.min(Number(m[2]), blob.size - 1);
  if (start >= blob.size || start > end) {
    return new Response(null, { status: 416 });
  }
  const sliced = blob.slice(start, end + 1);
  return new Response(sliced, {
    status: 206,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${blob.size}`,
      "Content-Length": String(sliced.size),
      "Accept-Ranges": "bytes",
    },
  });
}
