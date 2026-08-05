# Architecture

Technical direction for Sources du Vercors. [PROJECT.md](PROJECT.md) listed candidate technologies; this document records the **chosen** stack and the reasoning. Decisions marked **(decided)** are settled unless revisited deliberately; items marked **(open)** still need a call.

## Overview

A single Next.js application (frontend + API), PostgreSQL/PostGIS database, deployed as a PWA. Offline-first is the defining constraint and shapes almost every choice below.

```mermaid
flowchart LR
    subgraph Client["PWA (mobile-first)"]
        UI[React + MapLibre GL]
        SW[Service Worker<br/>app shell + tile cache]
        IDB[(IndexedDB<br/>sources, observations,<br/>outbox)]
    end
    subgraph Server["Next.js on Vercel"]
        API[API routes /api/v1]
    end
    DB[(PostgreSQL + PostGIS<br/>Neon)]
    OSM[OSM / Overpass<br/>periodic import]
    Tiles[PMTiles basemap<br/>static hosting/CDN]

    UI <--> SW
    UI <--> IDB
    SW <--> API
    API <--> DB
    OSM --> DB
    SW <--> Tiles
```

## Stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One deployable for UI + API; strong PWA story; matches the goal of demonstrating full-stack product engineering |
| UI | **React + Tailwind CSS** | Fast iteration, small surface |
| Map | **MapLibre GL JS** | Open-source, vector tiles, offline-capable, no vendor lock-in |
| Basemap tiles | **PMTiles (Protomaps build of OSM)** | Single-file vector tile archives served as static files with HTTP range requests — dramatically simplifies offline map download vs. running a tile server |
| API | **Next.js Route Handlers** under `/api/v1/*` | No separate backend to run; Hono can be revisited if the API outgrows this |
| Database | **PostgreSQL + PostGIS** | Geospatial queries (bbox, nearest-source) are core |
| ORM | **Prisma** | Productivity; PostGIS geometry handled via raw SQL / `Unsupported("geometry")` where needed — geo queries live in a small dedicated query module, not scattered |
| Auth | **Better Auth** | Lightweight, self-hosted, email magic-link first (no passwords to manage); OAuth later if wanted |
| Hosting | **Vercel** (app) + **Neon** (Postgres) | Free tiers fit MVP scale; both trivially replaceable |
| Photos (post-MVP) | S3-compatible object storage (e.g., Cloudflare R2) | Deferred entirely — schema keeps a nullable `photo_url` |

## Offline strategy (the core of the app)

Three layers of offline, in order of implementation:

1. **App shell** — Service worker precaches the application (standard PWA). The app opens with no network.
2. **Data** — Source list + derived statuses for the whole Vercors are small (a few hundred sources → well under 1 MB of JSON). On every online load, the client fetches the full snapshot and stores it in **IndexedDB**. Offline reads always hit IndexedDB first; the UI shows a "data as of <timestamp>" indicator (honesty principle).
3. **Map tiles** — User explicitly downloads the Vercors basemap (PMTiles archive, order of tens of MB for the massif at hiking zoom levels) for offline use. Until downloaded, tiles stream normally and the service worker caches what's viewed.

### Write path offline: the outbox

Observations and confirmations created offline are appended to an **outbox** in IndexedDB with a client-generated UUID and `observed_at` set to creation time, then replayed to the API when connectivity returns. **(decided, Phase 3)** Replay is client-side only — triggered on `online`, window focus/visibility, and a slow interval — rather than the SW Background Sync API: iOS has no Background Sync, so the focus path had to exist anyway, and one code path beats two. Replay stops on 401 (needs sign-in) and network/5xx (retry later); terminal 4xx drops the item rather than wedging the queue.

- The client UUID makes replay **idempotent** (server upserts by ID).
- **One queued reaction per observation.** Observations are keyed in the outbox by their own UUID — each is a distinct append-only fact, so several may queue for one source. A reaction is keyed by its *observation* instead (`reaction:<observationId>`), carrying its UUID in a separate field: the server upserts on (observation, user), so only the last tap can ever apply. Without the derived key, re-tapping stacked superseded writes and inflated the pending count. A reaction queued as a `dispute` before that half was retired is dropped on replay rather than delivered to the confirm endpoint, which would invert it.
- `observed_at` (when the hiker was at the source) is distinct from `created_at` (when the server received it) — critical for confidence computation. An `observed_at` older than the 7-day window is **refused, not clamped** (`lib/domain/observation-input.ts`): a queued observation can sit for days, and silently redating it to the floor would publish a stale reading as a fresh-ish one.
- Conflicts are a non-problem by design: observations are append-only facts; there is nothing to merge.

**Auth gates the flush, not the capture (decided 2026-08-05):** the report form is the default view of the source sheet for everyone — signed in or not, online or not. A write without a session goes to the outbox and the sign-in is asked for immediately *after*, when the taps are already spent (a 401 on submit queues rather than failing; offline it is known up front). Connectivity deliberately does not change what the sheet offers: one code path, and the cheapest step of the funnel is never behind a wall. Gating capture on a session bought nothing — the API's 401 is the entire defense and does not move — while leaving a signed-out hiker offline with no path at all, since magic-link sign-in needs a network and an inbox and so cannot happen in the field. A 401 during replay is distinguished from network/5xx and surfaced as a sign-in prompt; without that the queue wedges silently forever. A quiet "se connecter" link stays in the sheet for someone who wants to sign in first (their write is then delivered immediately instead of queued). Rejected **Better Auth's `anonymous` plugin** for provisioning a device identity at first online load: `POST /sign-in/anonymous` has no proof-of-human whatsoever, so it would remove the one anti-abuse property the app has, and it would still not close the hole — sign-out, session expiry and iOS PWA storage eviction all survive it. Session lifetime is set to a year (`lib/auth.ts`) because Better Auth's 7-day default made the signed-out-offline case routine rather than rare.

## Data flow: source statuses

Derived state `(status, confidence, last_observed_at, confirmations)` is computed **server-side** in one place (the `source_current_status` view — see [DATABASE.md](DATABASE.md)) and shipped to clients as part of the snapshot. Offline, the client re-derives it against its own clock so a source cached as High confidence 10 days ago degrades — running the *same* rule, not a variant of it: `deriveConfidence` (`lib/domain/confidence.ts`) takes exactly the two inputs the snapshot carries (`lastObservedAt`, `confirmationCount`), and unit tests hold it identical to the view's `CASE`. This became possible when the dispute reaction was retired in August 2026 ([DOMAIN.md](DOMAIN.md) § Confirmation); before that the snapshot lacked dispute counts and the client had to approximate the rule with a monotonic age cap.

## API sketch (v1)

Small, boring, versioned:

- `GET  /api/v1/sources` — full snapshot: all sources + derived status (the offline sync payload; ETag/If-None-Match)
- `GET  /api/v1/sources/:id` — source detail + recent observation history
- `POST /api/v1/observations` — create (idempotent by client UUID; auth required)
- `POST /api/v1/observations/:id/confirm` — confirm (auth required)

No GraphQL, no realtime. Snapshot + poll is plenty at this scale.

## Cross-cutting decisions

- **PWA, not native.** One codebase, no app-store friction. Accepted trade-offs: iOS PWA storage-eviction quirks and no reliable Background Sync on iOS (mitigation: sync on app focus; warn users not to delete the "installed" app).
- **Hand-rolled service worker (decided, Phase 3):** `public/sw.js`, plain JS, no Workbox/next-pwa. Next hashes chunk URLs, so the install step discovers app-shell assets by parsing the served HTML (and its CSS for fonts) instead of a build-time manifest. The downloaded PMTiles archive lives whole in Cache Storage (`sdv-basemap-v1`, unversioned — SW updates must not discard a 40 MB download); the SW answers MapLibre's Range requests by slicing it. `/api/*` is never SW-cached — offline data comes from IndexedDB only, one staleness model.
- **Offline session mirror (decided, Phase 3):** Better Auth's `useSession` needs the network, but a signed-in hiker offline must still see the report form. The last definitive session answer is mirrored to localStorage (`lib/offline/session.ts`) and used only when the session fetch errors; a definitive signed-out clears it. The outbox replay itself authenticates with the normal cookie.
- **Offline e2e simulates airplane mode by killing the server (decided, Phase 3):** browser-level network emulation doesn't reliably apply to service-worker fetches, so the Playwright spec owns a real `next start` (port 3210, separate `.next-e2e` build via `NEXT_DIST_DIR`, magic link read from server stdout) and kills/restarts it. Test data hangs off one dedicated `.test`-domain user, hard-deleted before and after each run.
- **Account deletion is not identity-permanent (decided 2026-08-04):** anonymisation releases the email, so a deleted user can sign up again with the same address and gets a fresh `user.id`. Accepted as-is: their previous contributions stay anonymised on the map and out of their reach, and repeated cycles only accumulate orphan `user` rows. Rejected the alternatives — a deny-list would make deletion a permanent ban on the address, and re-linking a returning email to the old row would rebuild the identity trail deletion just destroyed (DOMAIN.md § Users & trust).
- **i18n from day one (decided):** UI French-first; all user-facing strings live in a typed message catalog (`lib/i18n/fr.ts`), no i18n library for now. Revisit the library question when English is actually added.
- **MapLibre pinned to v5:** maplibre-gl 6.0.0 (released 2026-07) silently fails to load any style in our setup (style stays unparsed, no errors emitted). Stay on ^5 until v6.x is verified working.
- **Performance budgets:** initial JS < 300 KB gzipped (MapLibre dominates; code-split everything else); map interactive < 3 s on a mid-range phone over 4G.
- **Privacy:** no tracking of user location server-side; geolocation is used client-side only to center the map. No analytics beyond privacy-friendly aggregate counts (open: Plausible vs. nothing).
- **Testing:** unit tests for the confidence/derivation logic (the one algorithm that matters), integration tests for API routes, one Playwright happy-path (view map → open source → submit observation) including an offline-mode scenario.

## Repository layout (planned)

Single app repo, no monorepo tooling until needed:

```
/app            Next.js App Router (pages + API route handlers)
/components     React components
/lib            domain logic (confidence rules, status derivation, shared constants)
/lib/db         Prisma client + geo query module (raw SQL lives here only)
/lib/offline    IndexedDB access, outbox, sync
/prisma         schema.prisma + migrations
/scripts        OSM import + data tooling (see DATA_SOURCES.md)
/public         PWA manifest, icons
```

## Revisit triggers

- If Prisma + raw-SQL PostGIS becomes painful → evaluate Drizzle or Kysely.
- If snapshot payloads outgrow ~5 MB (multi-massif future) → move to bbox/tile-scoped data endpoints.
- If Vercel serverless limits bite (import jobs, image processing) → move background jobs to a small worker (Railway).
