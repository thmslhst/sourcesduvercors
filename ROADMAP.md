# Roadmap

Phased delivery plan. Each phase produces something usable and de-risks the next. No dates — phases complete when their exit criteria are met. Scope guardrails: anything in [PROJECT.md](PROJECT.md) § Non Goals stays out regardless of phase.

## Phase 0 — Foundations

Project scaffolding and data groundwork.

- [x] Next.js + TypeScript + Tailwind scaffold, deployed to Vercel (hello-world live)
- [x] Neon Postgres + PostGIS enabled; Prisma set up; initial migration ([DATABASE.md](DATABASE.md) schema)
- [x] OSM import script; Vercors catalog imported and sanity-checked ([DATA_SOURCES.md](DATA_SOURCES.md)) — 657 sources
- [x] CI: typecheck, lint, unit tests on push

**Exit:** the full Vercors source catalog sits in the production database; the deployed app builds and loads.

## Phase 1 — Read-only map (first useful artifact)

A hiker can *see* every water source in the Vercors.

- [x] MapLibre map, PMTiles/Protomaps basemap, centered on the Vercors
- [x] Sources rendered with status colors (all `unknown` gray at this point) and type icons
- [x] Source detail sheet: name, type, elevation, status placeholder
- [x] Geolocation: center-on-me
- [x] `GET /api/v1/sources` snapshot endpoint
- [x] Mobile-first layout, OSM attribution

**Exit:** shareable URL where anyone can browse Vercors water sources on their phone.

## Phase 2 — Observations & confidence (the actual product)

The community loop: report → confirm → trust.

- [x] Better Auth with magic-link email; minimal account (display name)
- [x] Submit observation flow (≤ 3 taps: source → status → send; optional comment)
- [x] Confirm / dispute on the latest observation
- [x] `source_current_status` view wired through API; map colors + confidence badges go live
- [x] Source detail shows observation history ("flowing well — 3 days ago, confirmed by 2")
- [x] Admin soft-delete for abusive content
- [x] Unit tests locking the confidence rules ([DOMAIN.md](DOMAIN.md))

**Exit:** two different users can report and confirm a real spring, and the map reflects it with correct confidence.

## Phase 3 — Offline (the defining feature)

Everything works on the plateau with zero bars.

- [x] PWA: manifest, service worker, installable, app shell cached
- [x] Sources + statuses snapshot persisted to IndexedDB; "data as of <time>" indicator; age-based confidence decay offline
- [x] Offline outbox for observations/reactions; sync on reconnect/app-focus; idempotent replay (client UUIDs)
- [x] Downloadable Vercors basemap (PMTiles) with size shown before download
- [x] Playwright offline scenario: airplane mode → browse → submit → reconnect → synced (`npm run test:e2e`)

**Exit:** a phone in airplane mode can browse sources with statuses and queue an observation that syncs later. **This is the MVP.**

## Phase 4 — Polish & launch

Make it trustworthy and known.

- [ ] French UI pass (French-first, English secondary)
- [ ] Empty/edge states, safety disclaimer copy, about page (licensing, how confidence works)
- [ ] Performance pass against budgets in [ARCHITECTURE.md](ARCHITECTURE.md)
- [ ] Seed real data: contributors observe sources on actual Vercors outings
- [ ] Outreach: local hiking groups/forums, park contact, open-source announcement

**Exit criteria = success criteria in [VISION.md](VISION.md):** a hiker planning a summer trek uses it to decide where to refill.

## Post-MVP backlog (unordered, deliberately unplanned)

- Photos on observations (R2 storage, moderation implications)
- Seasonal statistics per source; season-aware confidence windows
- Additional massifs (schema is ready via `region`; the product work is community, not code)
- Predictive reliability (rainfall, elevation, historical models)
- Route analysis ("14 km without confirmed water") — requires GPX import, tread carefully vs. non-goals
- Public data export / API for partners (park, associations)
