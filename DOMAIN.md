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

A source has a fixed location (point geometry), a name when known (e.g., "Fontaine de Chaumailloux"), and an elevation. It carries no free text: everything about the water comes from observations ([DATABASE.md](DATABASE.md) § Notes on choices).

**Potability is not a status.** Whether water is treated/potable is a property of the source (its `drinking_water` type), while **flow** is what observations track. The app never certifies potability.

### Observation

A single report by a user about a source at a moment in time. The atomic unit of value in the system.

Fields: source, author, **status**, observed-at timestamp, optional tags, optional photo (post-MVP).

**Tags** are a closed vocabulary — never free text. A four-value status can't say *why*: for a `fountain`, `drinking_water` or `cistern` a dry reading may mean a broken tap rather than a dry spring, and a source can flow perfectly while being impossible to fill a bottle from.

Listed in the order a hiker meets the source — find it, fill it, then judge it:

| Tag | FR label | What the reader does about it |
|---|---|---|
| `hard_to_find` | Difficile à trouver | Budget time, look around |
| `hard_to_fill` | Écoulement peu accessible | Bring a cup; don't plan a 3 L refill |
| `out_of_order` | Hors service | Don't count on it at all |
| `cloudy_water` | Eau trouble | Filter or treat it, or skip |

That last column is the admission test: **a tag exists only if a reader would act differently for it.** Tags are exception reports — no tag means an ordinary source, which is what keeps the happy path at zero extra taps ([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md) § 6). Two deliberate omissions follow from it: *terrain difficulty*, which is a routing statement and belongs to the navigation app the hiker already carries; and *pin accuracy*, which was a maintenance report filed into a product with no maintenance path — the app can't move a pin, and whoever reports it has already found the source. Both are absorbed by `hard_to_find`, which says the only thing the next person can use.

`hard_to_fill` means **geometry, not slowness** — no spout, no clearance, a seep with nothing to hold a bottle under. Slowness is what `low_flow` and `dripping` already say.

Tags are **descriptive only — they never affect the derived status or confidence.** Trust comes from age, confirmations and disputes and nothing else (see § Confidence model). A closed list also means nothing needs moderating, nothing needs editing, and the labels live in `lib/i18n` like every other string. Free-text comments existed until July 2026 and were replaced by this list; the list itself was reworked at the end of that month.

Known limitation: `hard_to_find` is really a property of the *source*, not of a visit, so it gets re-reported identically forever and history shows it dated. Acceptable while it is also how we learn which sources deserve it; post-MVP it may graduate to a source-level badge once enough observations agree.

### Confirmation

A lightweight "+1" on an existing recent observation: "I was there, it's still like this." Cheaper to give than a full observation, and it raises confidence. Modeled as its own record pointing at the observation it confirms.

Because it is the cheapest useful contribution — and the only one that can lift a source to high confidence — it is the **promoted action** in the sheet, above the report form. It is offered only while a confirmation would still change the derived confidence (inside the `high` age window); past that, a fresh observation is the useful contribution, not a "+1" on a stale one.

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
- No reputation scores, badges, or levels in the MVP.
- No public identity at all: an account is an email address and nothing else. Observations are attributed internally (`user_id` — needed for one-reaction-per-user, "your observation", and moderation) but never published under a name. Corroboration is credited anonymously and in aggregate: "confirmé par 2 randonneurs". A stable pseudonym attached to timestamped, geolocated observations is a movement trace, and the confidence model never reads identity anyway (see § Confidence model).
- Moderation MVP: soft-delete of abusive content by an admin flag; nothing fancier.
- An author can **retract** their own observation. Observations are still never edited — a retraction is a soft-delete, and since the derived status reads the latest non-deleted observation, retracting the newest one revives the previous answer. Without this, a mis-tapped `dry` is the map's answer for weeks and only an admin can take it back. Retracting requires connectivity.
- An account can be deleted by its owner, which means **anonymised**: the email is overwritten with an unusable address and every session dropped, while the observations stay on the map under an opaque id. Hard deletion is not offered — observations are append-only and other people's reactions and the derived status depend on them, so erasing a contributor would degrade the answer for everyone else. Nothing personal is published in the first place, so nothing personal survives.
- **Deleting frees the email; re-registering makes a new person** (confirmed 2026-08-04). Because deletion overwrites the address, the UNIQUE constraint no longer holds it and the same email can sign up again — no cooldown, no deny-list, and nothing in the sign-in path reads `deleted_at`. The new account is a distinct `user.id`, so the earlier observations and reactions stay on the anonymised row: they remain on the map, and their former author can no longer retract or react to them. Deletion is a one-way door by design, not by oversight — the alternative is a re-linkable identity, which is exactly the movement trace this section refuses. Each cycle leaves one anonymised row behind; unavoidable while observations reference `user` with RESTRICT, and harmless at this scale.

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
