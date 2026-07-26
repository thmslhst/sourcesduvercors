# Product Principles

These principles resolve day-to-day product and design decisions. When a feature idea or implementation choice conflicts with them, the principles win.

## 1. One problem only

The app answers **"Can I trust this water source?"** — nothing else. Every feature must serve that question. Route planning, GPX editing, navigation, weather, social features, messaging, achievements, and rich user profiles are explicit non-goals (see [PROJECT.md](PROJECT.md) § Non Goals).

**Test:** if a feature would also make sense in Komoot or AllTrails, it probably doesn't belong here.

## 2. Complement, don't compete

Hikers keep their favorite navigation app. We never try to own the whole hike — only the water question. Integration-friendly (e.g., one day exporting source status) beats feature parity with navigation apps.

## 3. Offline-first, not offline-tolerant

The app is used where there is no network. Offline is the primary scenario, not a degraded mode:

- The map, source data, and recent observations must work with zero connectivity.
- Submitting an observation offline must succeed locally and sync later.
- Never block the UI on a network request.

## 4. Seconds, not minutes

A tired hiker with cold fingers and 8% battery is the design target.

- Core answers (nearest source, its status, its confidence) reachable in ≤ 2 taps.
- Submitting an observation: ≤ 3 taps for the happy path (pick source → pick status → send).
- Fast initial load, tiny payloads, no splash screens, no onboarding walls.

## 5. Honest about uncertainty

Community data is imperfect. Never present stale or unconfirmed data as fresh truth.

- Always show **when** a source was last observed, not just its status.
- Show confidence explicitly (see [DOMAIN.md](DOMAIN.md)); "unknown" is a first-class, honest answer.
- Old observations decay: a "flowing well" from three months ago must not look like one from yesterday.
- Safety framing: the app helps assess risk; it never guarantees water. Copy should reflect that.

## 6. Contribution must be effortless

The data model lives or dies on fresh observations. Anything that adds friction to contributing (long forms, mandatory photos, mandatory accounts for confirmations if avoidable) is a direct threat to the product. Optimize the report flow above all other flows except reading status.

## 7. Clarity over visual complexity

Inspired by Organic Maps, Google Maps, and modern weather apps:

- The map **is** the interface. No dashboard, no feed.
- Status must be legible at a glance on the map itself (color + icon, colorblind-safe, readable in sunlight).
- Prefer plain words ("dry", "flowing well") over jargon or scores alone.

## 8. Lightweight is a feature

Mobile-first PWA, small bundle, minimal dependencies, no heavyweight frameworks beyond what the stack requires. Performance budgets are product requirements, not nice-to-haves.

## 9. Vercors first

Depth in one massif beats breadth across many. The data model may stay region-agnostic, but product, content, and community effort focus exclusively on the Vercors until the MVP proves itself.

## 10. Open by default

Open-source code, open data practices compatible with OSM's ODbL (see [DATA_SOURCES.md](DATA_SOURCES.md)), transparent confidence rules. Trust in community data requires being able to inspect how it works.
