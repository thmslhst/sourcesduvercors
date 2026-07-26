# Domain Model

The shared vocabulary and rules of the product. Code, database, API, and UI should all use these terms consistently.

## Core concepts

### Water source

A physical point where a hiker might obtain water. Types (initial set, mapped from OSM tags — see [DATA_SOURCES.md](DATA_SOURCES.md)):

| Type | Meaning | Typical OSM tagging |
|---|---|---|
| `spring` | Natural spring | `natural=spring` |
| `fountain` | Village fountain / trough | `amenity=fountain`, `man_made=water_tap` |
| `drinking_water` | Tap or maintained potable point | `amenity=drinking_water` |
| `cistern` | Rainwater cistern / citerne | `man_made=water_tank` etc. |
| `stream` | Reliable stream crossing worth mapping | `waterway=stream` (curated, not bulk-imported) |
| `other` | Anything else worth knowing about | — |

A source has a fixed location (point geometry), a name when known (e.g., "Fontaine de Chaumailloux"), an elevation, and optional notes (e.g., "10 min off-trail, follow cairns").

**Potability is not a status.** Whether water is treated/potable is a property of the source (`drinking_water` type or notes), while **flow** is what observations track. The app never certifies potability.

### Observation

A single report by a user about a source at a moment in time. The atomic unit of value in the system.

Fields: source, author, **status**, observed-at timestamp, optional comment, optional photo (post-MVP).

### Confirmation

A lightweight "+1" on an existing recent observation: "I was there, it's still like this." Cheaper to give than a full observation, and it raises confidence. Modeled as its own record pointing at the observation it confirms.

### Dispute (report outdated)

The inverse of a confirmation: "this no longer matches what I saw." A dispute lowers confidence and prompts for a fresh observation. It never deletes data.

## Status scale

Ordered from best to worst. Exactly these five values, everywhere:

| Status | Meaning for a hiker | Map color (colorblind-safe, final palette TBD) |
|---|---|---|
| `flowing` | Flowing well — refill with confidence | Blue |
| `low_flow` | Weak but usable flow — refill possible, allow time | Teal/green |
| `dripping` | Barely dripping — emergency-only, very slow | Orange |
| `dry` | No water | Red |
| `unknown` | No (recent) observation | Gray |

`unknown` is never stored as an observation status — it is the *derived* state of a source with no usable observation.

## Confidence model

Confidence answers: **"How much should I trust the displayed status?"** It is derived, never stored as ground truth, and must be cheap to compute and easy to explain in the UI.

Inputs:

- `age` — days since the latest observation,
- `confirmations` — count of confirmations on that observation,
- `disputes` — count of disputes on that observation.

Initial rules (v1 — deliberately simple, tunable constants in one place in code):

| Confidence | Rule (v1) |
|---|---|
| **High** | age ≤ 7 days AND confirmations ≥ 1 AND disputes = 0 |
| **Medium** | age ≤ 21 days AND disputes = 0 |
| **Low** | age ≤ 60 days, OR any disputes on a newer-than-60-days observation |
| **Unknown** | no observation in the last 60 days |

Additional rules:

- A dispute on the latest observation immediately caps confidence at **Low** until a newer observation arrives.
- Seasonality matters (a March "flowing" says little about August): time windows may later become season-aware. v1 ignores this — documented limitation.
- The UI always shows the underlying facts alongside the label: "*flowing well — observed 3 days ago, confirmed by 2 hikers*".

## Source display state (what the map shows)

For each source the app derives: `(status, confidence, last_observed_at, confirmation_count)` from the latest non-disputed observation, falling back to `unknown`. This derivation should live in **one** shared function/query used by API and offline cache alike.

## Users & trust (MVP scope)

- Reading requires no account.
- Contributing requires a minimal account (see [ARCHITECTURE.md](ARCHITECTURE.md) — auth) so observations are attributable and abuse is manageable.
- No reputation scores, badges, or levels in the MVP. An author's display name and observation history are enough.
- Moderation MVP: soft-delete of abusive content by an admin flag; nothing fancier.

## Glossary (FR ⇄ EN)

The audience is largely French; UI will likely be French-first with English support. Keep terminology aligned:

| French | English | Code identifier |
|---|---|---|
| source | spring / water source | `spring` / `water_source` |
| fontaine | fountain | `fountain` |
| citerne | cistern | `cistern` |
| captage | water catchment | — |
| débit | flow | `flow` |
| en eau / coule bien | flowing well | `flowing` |
| faible débit | low flow | `low_flow` |
| goutte-à-goutte | dripping | `dripping` |
| à sec / tarie | dry | `dry` |
| observation / relevé | observation | `observation` |
| confirmation | confirmation | `confirmation` |
| signalement obsolète | outdated report / dispute | `dispute` |
