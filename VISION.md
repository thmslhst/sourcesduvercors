# Vision

> One question, answered well: **"Can I trust this water source?"**

## The problem

In limestone ranges like the Vercors, surface water is scarce and springs are often seasonal. OpenStreetMap and paper maps tell hikers **where** springs are — but not **whether they are flowing right now**. In summer, a mapped spring can be completely dry while another a few kilometers away still flows.

For a multi-day hiker, this uncertainty is not a detail. It determines:

- how much water weight to carry,
- which route variants are safe,
- whether a trek is feasible at all during dry periods.

Existing information (park websites, forum posts, scattered PDFs) is fragmented, stale, and unusable mid-hike.

## Origin

The project comes from a real experience: during a 3-day Vercors trek, the founder reached a mapped spring after running out of water and found it dry, forcing a significant detour to another spring that fortunately still had a small flow. See [PROJECT.md](PROJECT.md) for the full original brief.

## What we are building

A **lightweight, offline-first, community-driven web app** where hikers:

1. see all mapped water sources in the Vercors on a map,
2. see each source's **current status** (flowing → dry) and a **confidence level** based on recency and confirmations,
3. contribute observations in seconds, even offline.

## What we are *not* building

Not another navigation app. No routing, no GPX, no social network. Hikers keep using Komoot / Gaia / Organic Maps for navigation; Sources du Vercors answers the one question those apps can't. See [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md).

## Long-term direction (post-MVP, explicitly out of scope for now)

- Additional mountain ranges (the data model should not hard-code the Vercors, but the product focus does).
- Predictive reliability: statistical/ML estimates from historical observations, season, elevation, rainfall, temperature.
- Route analysis: "Your planned route contains a 14 km section without any recently confirmed water source."
- Seasonal statistics per source.

## Success criteria

The MVP succeeds if a hiker planning a Vercors trek can confidently answer, in seconds:

- Which springs are currently flowing?
- Which ones are probably dry?
- Where should I refill?
- Which sections require carrying extra water?

Secondary success signals:

- Observations are fresh (median age of latest observation per popular source < 2 weeks in summer).
- Contribution is effortless enough that a meaningful share of viewers also report.
- Local actors (park, hiking associations, guides) see it as trustworthy and worth supporting.

## Open source

The project intends to be open source: transparency builds trust in community data, and it enables collaboration with local hiking communities and potential partnerships with the Vercors Regional Natural Park.
