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

- [x] Better Auth with magic-link email; minimal account (email only — no display name)
- [x] Submit observation flow (≤ 3 taps: source → status → send; optional tags)
- [x] Confirm the latest observation (a matching "dispute" shipped here too; retired in Phase 4 — [DOMAIN.md](DOMAIN.md) § Confirmation)
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

- [x] French UI pass (French-first, English secondary) — every user-facing string lives in `lib/i18n/fr.ts`; English stays post-MVP
- [x] Empty/edge states, safety disclaimer copy, about page (licensing, how confidence works, what happens to an e-mail address)
- [x] Contribute flow polish: confirm-first CTA on a fresh observation, structured tags instead of free-text comments, author retraction
- [x] Retire the dispute reaction: confirmation is the only "+1", the useful answer to a changed source is a fresh observation, and server and offline client now run one identical derivation ([DOMAIN.md](DOMAIN.md) § Confirmation)
- [x] Offline contribution without a session: capture into the outbox, claim it with a sign-in on reconnect (auth gates the flush, not the capture)
- [x] A refused contribution is never deleted by the app: it stays on the device, listed with the reason, retried or removed only by the hiker — and the sheet no longer offers a signed-out hiker the self-confirmation the server always refused
- [x] Link surface for the announcement: generated social card, canonical `www` host, `robots.txt`
- [ ] Performance pass against budgets in [ARCHITECTURE.md](ARCHITECTURE.md) — initial JS measured at 221 KB compressed against the 300 KB budget; "map interactive < 3 s" still unmeasured, waiting on Speed Insights field data rather than a lab number
- [x] Magic-link delivery from a verified sending domain (Resend's shared sender reached only the account owner, so until this landed nobody but the maintainer could sign in)
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
