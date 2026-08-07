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
| `hard_to_fill` | Difficile à remplir | Bring a cup; don't plan a 3 L refill |
| `out_of_order` | Hors service | Don't count on it at all |
| `cloudy_water` | Eau trouble | Filter or treat it, or skip |

That last column is the admission test: **a tag exists only if a reader would act differently for it.** Tags are exception reports — no tag means an ordinary source, which is what keeps the happy path at zero extra taps ([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md) § 6). Two deliberate omissions follow from it: *terrain difficulty*, which is a routing statement and belongs to the navigation app the hiker already carries; and *pin accuracy*, which was a maintenance report filed into a product with no maintenance path — the app can't move a pin, and whoever reports it has already found the source. Both are absorbed by `hard_to_find`, which says the only thing the next person can use.

`hard_to_fill` means **geometry, not slowness** — no spout, no clearance, a seep with nothing to hold a bottle under. Slowness is what `low_flow` and `dripping` already say.

Tags are **descriptive only — they never affect the derived status or confidence.** Trust comes from age and confirmations and nothing else (see § Confidence model). A closed list also means nothing needs moderating, nothing needs editing, and the labels live in `lib/i18n` like every other string. Free-text comments existed until July 2026 and were replaced by this list; the list itself was reworked at the end of that month.

Known limitation: `hard_to_find` is really a property of the *source*, not of a visit, so it gets re-reported identically forever and history shows it dated. Acceptable while it is also how we learn which sources deserve it; post-MVP it may graduate to a source-level badge once enough observations agree.

### Confirmation

A lightweight "+1" on an existing recent observation: "I was there, it's still like this." Cheaper to give than a full observation, and it raises confidence. Modeled as its own record pointing at the observation it confirms.

Because it is the cheapest useful contribution — and the only one that can lift a source to high confidence — it is the **promoted action** in the sheet, above the report form. It is offered while a confirmation can still change the derived confidence (inside the `high` age window). Past that window a "+1" moves nothing, so the same prompt switches to asking for the reading again — see § Re-observing below.

There is exactly one prompt, in one shape, whatever it is asking. A smaller inline "Confirmer" pill lived in the history list until August 2026 for the cases the promoted card refused; the same act looking major or minor depending on the observation's age was the inconsistency, not the size of either control.

### Re-observing

Past the freshness window, a hiker standing at the source can restate the latest reading in one tap: **"C'est toujours le cas"**. This is a *new observation* carrying the old one's status, dated now — never an edit or a redating of the old row (observations are append-only, and the server refuses a backdated observation outright rather than clamping it). Tags are not carried over: they described what that hiker saw, and restating a status is not a claim that "difficile à trouver" still holds.

Two consequences worth stating plainly:

- It lands the source at `medium`, never `high` — a brand-new observation has no confirmations. So it can only raise trust from `low`, which is why it is offered exactly past the freshness window and not inside it. Inside, replacing a confirmed observation with an unconfirmed one would *lower* confidence.
- It is offered to the original author too. There is no self-inflation to guard against for the same reason: an uncorroborated observation cannot reach `high` however many times its author restates it.

Beyond the `known` window (60 days) the prompt disappears entirely. Nothing about a two-month-old reading is worth restating; the status grid is the honest path.

Confirmation is the **only** reaction. A `dispute` ("Signaler obsolète") existed until August 2026 and capped confidence at `low`; it was removed. Three reasons, in order of weight:

- **A dispute is a weaker version of an act the app already asks for.** Whoever can tell that a source has changed is standing at it, and a fresh observation says what is actually there instead of only that the old answer is wrong. The sheet said as much in the dispute's own copy.
- **It was the one trust signal that did not survive offline.** The map snapshot never carried dispute counts, so a disputed source kept showing its cached, higher confidence to a hiker with no network — the exact moment the warning mattered.
- **It was the only reason "one derivation" was not literally true.** Because the client could not see disputes, it approximated the rule with an age cap. Age and confirmations are both in the snapshot, so server and offline client now run the same function (`lib/domain/confidence.ts`).

What this gives up, knowingly: a dispute was the only *remote* negative signal — no location, no status. The remaining path is to report the current state, which is also the only claim anyone can vouch for. Existing dispute rows stay in the database as historical record (observations are append-only) but no longer count toward anything.

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
- `confirmations` — count of confirmations on that observation.

Initial rules (v1 — deliberately simple, tunable constants in one place in code):

| Confidence | Rule (v1) |
|---|---|
| **High** | age ≤ 7 days AND confirmations ≥ 1 |
| **Medium** | age ≤ 7 days |
| **Low** | age ≤ 60 days |
| **Unknown** | no observation in the last 60 days |

Read out loud: **high** = seen this week and corroborated, **medium** = seen this week, **low** = older than a week, **unknown** = nothing in two months. `Medium` ran to 21 days until August 2026; the middle window was the one nobody could justify, and three weeks of `medium` on a karst spring in August is precisely where the unmodelled seasonality below did the most damage. Collapsing it also gives the sheet's re-observe prompt something visible to deliver (`low` → `medium`).

Additional rules:

- The rules are evaluated top to bottom; the first match wins. An unconfirmed observation is therefore **Medium** at best, from the moment it is posted.
- Confidence is **monotonic in age**: for fixed inputs it only ever falls as time passes. That is what lets the offline client re-run the rule against its own clock without a source ever appearing to regain trust.
- Seasonality matters (a March "flowing" says little about August): time windows may later become season-aware. v1 ignores this — documented limitation.
- The UI always shows the underlying facts alongside the label: "*flowing well — observed 3 days ago, confirmed by 2 hikers*".

## Source display state (what the map shows)

For each source the app derives: `(status, confidence, last_observed_at, confirmation_count)` from the latest non-deleted observation, falling back to `unknown`. This derivation lives in **one** rule, expressed twice and kept identical by tests: the `source_current_status` SQL view (the server's only source of truth) and `deriveConfidence` in `lib/domain/confidence.ts`, which the offline cache re-runs over the snapshot.

## Users & trust (MVP scope)

- Reading requires no account.
- Contributing requires a minimal account (see [ARCHITECTURE.md](ARCHITECTURE.md) — auth) so observations are attributable and abuse is manageable. The account is required for an observation to be **recorded**, not to be **captured**: magic-link sign-in needs a network and a mail round-trip, so it is impossible in the field, and gating the form on a session would leave a signed-out hiker on the plateau with no way to contribute at all. Capture is unauthenticated and local to the device — the report form is the default view for everyone, regardless of connectivity — and the outbox holds the observation until a sign-in claims it, where the API's 401 enforces attribution exactly as before. Nothing reaches the database unattributed.
- **A queued contribution must be claimed within 7 days** — the `observed_at` window (see § Confidence model). Past that the server refuses it rather than redating it, and the app says so both when queueing and when dropping. An unclaimed observation is lost, which is the honest outcome: nobody can vouch for when it was taken.
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
