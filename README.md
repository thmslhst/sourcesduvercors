# Sources du Vercors

Offline-first PWA helping hikers assess whether natural water sources in the
Vercors are actually flowing. One question only: **"Can I trust this water
source?"**

Project documentation lives at the repo root — start with
[PROJECT.md](PROJECT.md) and [ROADMAP.md](ROADMAP.md);
[CLAUDE.md](CLAUDE.md) indexes the rest.

## Stack

Next.js (App Router) + TypeScript + Tailwind · PostgreSQL/PostGIS (Neon) +
Prisma · Vercel. Map (MapLibre + PMTiles) and auth (Better Auth) arrive in
later phases — see [ARCHITECTURE.md](ARCHITECTURE.md).

## Development

```bash
npm install            # also runs prisma generate
npm run dev            # http://localhost:3000
npm test               # unit tests (Vitest)
npm run typecheck
npm run lint
```

CI runs typecheck, lint, and tests on every push and pull request.

## Database setup (Neon)

One-time, from the [Neon console](https://console.neon.tech) or CLI:

1. Create a project (Postgres 17, region `aws-eu-central-1` or similar).
2. Copy the connection string into `.env` as `DATABASE_URL`
   (see [.env.example](.env.example)).
3. Apply the schema — the initial migration enables PostGIS itself:

```bash
npm run db:migrate
```

## Importing the OSM catalog

```bash
npm run import:osm -- --dry-run                                  # fetch + report only
npm run import:osm                                               # fetch + upsert into DATABASE_URL
npm run import:osm -- --from-file=data/overpass-vercors.json     # use the committed snapshot
```

Re-imports are idempotent (upsert on `osm_type`+`osm_id`) and never overwrite
curated fields. Disappeared OSM elements are reported for manual review, never
auto-deactivated. See [DATA_SOURCES.md](DATA_SOURCES.md).

## Deploying (Vercel)

One-time: create the Vercel project and link it to this repo (dashboard →
"Add New Project", or `npx vercel link`), then set the `DATABASE_URL`
environment variable in the project settings. Every push to `main` deploys
automatically.

## Licensing

Code is [MIT](LICENSE). The water-source catalog is derived from
[OpenStreetMap](https://www.openstreetmap.org/copyright) data and remains
© OpenStreetMap contributors under
[ODbL](https://opendatacommons.org/licenses/odbl/).
