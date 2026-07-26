# Sources du Vercors

Offline-first PWA helping hikers assess whether natural water sources in the Vercors are actually flowing. Community observations + confidence levels on a map. One question only: **"Can I trust this water source?"**

**Status:** Phase 2 (observations & confidence) complete — magic-link auth (Better Auth), observation submit + confirm/dispute, derived status/confidence live on map and detail sheet, admin soft-delete. Next: Phase 3 (offline) of [ROADMAP.md](ROADMAP.md).

## Context documents

Read the ones relevant to the task at hand:

| File | What it answers |
|---|---|
| [PROJECT.md](PROJECT.md) | The original founding brief (kept verbatim; other docs refine it) |
| [VISION.md](VISION.md) | Why this exists, success criteria, long-term direction |
| [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md) | Decision rules: scope, offline-first, honesty about uncertainty, tap budgets |
| [DOMAIN.md](DOMAIN.md) | Vocabulary, status scale, confidence rules, FR/EN glossary |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Chosen stack, offline strategy, API sketch, repo layout, revisit triggers |
| [DATABASE.md](DATABASE.md) | Schema, derived-status view, migration approach |
| [DATA_SOURCES.md](DATA_SOURCES.md) | OSM import, tag mapping, ODbL licensing obligations |
| [ROADMAP.md](ROADMAP.md) | Phases 0–4 with exit criteria; post-MVP backlog |

## Hard rules for any work here

- **Scope:** no navigation, routing, GPX, weather, or social features — see non-goals in PROJECT.md. If a request drifts there, flag it.
- **Vocabulary:** use the exact identifiers from DOMAIN.md (`flowing`, `low_flow`, `dripping`, `dry`; `unknown` is derived, never stored).
- **One derivation:** status/confidence rules exist in exactly one place (DB view + shared constants). Never duplicate the logic ad hoc.
- **Offline is primary:** any new feature must state how it behaves with zero connectivity.
- **Observations are append-only** — no updates or hard deletes (soft-delete only; reactions are the one editable record).
- **Licensing:** OSM-derived data is ODbL; keep attribution intact.

## Stack (summary — details in ARCHITECTURE.md)

Next.js (App Router) + TypeScript + Tailwind · MapLibre GL + PMTiles · PostgreSQL/PostGIS (Neon) + Prisma · Better Auth · Vercel · PWA (service worker + IndexedDB outbox).
