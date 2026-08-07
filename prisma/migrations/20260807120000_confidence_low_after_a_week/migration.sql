-- Shrink the `medium` window from 21 days to 7, so anything not seen this
-- week reads `low`.
--
-- The v1 ladder had three windows (7 / 21 / 60) and no way to explain the
-- middle one. It now has two, and says something a hiker can hold in their
-- head: high = seen this week and corroborated, medium = seen this week, low
-- = older than a week, unknown = nothing in two months. DOMAIN.md § Confidence
-- model already conceded that seasonality is unmodelled in v1; a three-week
-- `medium` on a karst spring in August was the place that concession did the
-- most damage.
--
-- It also makes the sheet's re-observe prompt honest. Past a week a
-- confirmation cannot lift anything, so the prompt asks the hiker standing
-- there to restate the reading with today's date instead — and under the old
-- windows that tap left a 10-day-old source on `medium`, visibly changing
-- nothing. Now it lifts `low` → `medium`, which is what the tap promises.
--
-- Confidence stays monotonic in age (it only ever falls for fixed inputs),
-- which is what lets the offline client re-run the rule against its own clock
-- — see lib/domain/confidence.ts, which mirrors this CASE and is locked to it
-- by unit tests.
--
-- Replaced in place rather than dropped and recreated: the output columns are
-- unchanged, and this database is the one production reads, so there must be
-- no instant where the view does not exist.
CREATE OR REPLACE VIEW "source_current_status" AS
SELECT
  s.id AS source_id,
  o.status,                                   -- NULL → 'unknown' in API layer
  o.observed_at AS last_observed_at,
  COALESCE(r.confirms, 0)  AS confirmation_count,
  CASE
    WHEN o.id IS NULL OR o.observed_at < now() - interval '60 days' THEN 'unknown'
    WHEN o.observed_at >= now() - interval '7 days'
         AND COALESCE(r.confirms, 0) >= 1                           THEN 'high'
    WHEN o.observed_at >= now() - interval '7 days'                 THEN 'medium'
    ELSE 'low'
  END AS confidence
FROM water_sources s
LEFT JOIN LATERAL (
  SELECT id, status, observed_at FROM observations
  WHERE source_id = s.id AND deleted_at IS NULL
  ORDER BY observed_at DESC LIMIT 1
) o ON true
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE type = 'confirm' AND deleted_at IS NULL) AS confirms
  FROM observation_reactions WHERE observation_id = o.id
) r ON true
WHERE s.is_active;
