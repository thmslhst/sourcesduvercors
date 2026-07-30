-- Replace the free-text comment with a closed tag vocabulary.
--
-- Same reasoning that dropped water_sources.description: the app answers one
-- question, and free text sitting next to an observation blurred which part of
-- the card the app stands behind. A comment was unmoderatable (anyone could
-- write anything), unusable by the confidence model, and French-only in a
-- catalog that keeps every string in lib/i18n — while the thing hikers
-- actually needed to say ("the tap is broken", "the water is cloudy") fits a
-- fixed list.
--
-- Tags are descriptive metadata only: nothing here feeds source_current_status.
CREATE TYPE observation_tag AS ENUM (
  'cloudy_water',
  'hard_access',
  'wrong_location',
  'broken_fixture'
);

ALTER TABLE observations
  ADD COLUMN tags observation_tag[] NOT NULL DEFAULT '{}';

-- source_current_status has to go first: its LATERAL join used SELECT *, so
-- Postgres pinned every column of observations — including comment — as a
-- dependency. Recreated below selecting only the three columns it actually
-- reads, so the next column change doesn't have to touch the view at all.
DROP VIEW source_current_status;

ALTER TABLE observations DROP COLUMN "comment";

-- Verbatim re-creation of the view (prisma/migrations/20260726000000_init)
-- apart from that narrowed LATERAL select. The day-window constants (7/21/60)
-- are still mirrored in lib/domain/constants.ts — change them in both places
-- or not at all.
CREATE VIEW "source_current_status" AS
SELECT
  s.id AS source_id,
  o.status,                                   -- NULL → 'unknown' in API layer
  o.observed_at AS last_observed_at,
  COALESCE(r.confirms, 0)  AS confirmation_count,
  COALESCE(r.disputes, 0)  AS dispute_count,
  CASE
    WHEN o.id IS NULL OR o.observed_at < now() - interval '60 days' THEN 'unknown'
    WHEN COALESCE(r.disputes, 0) > 0                                THEN 'low'
    WHEN o.observed_at >= now() - interval '7 days'
         AND COALESCE(r.confirms, 0) >= 1                           THEN 'high'
    WHEN o.observed_at >= now() - interval '21 days'                THEN 'medium'
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
    count(*) FILTER (WHERE type = 'confirm' AND deleted_at IS NULL) AS confirms,
    count(*) FILTER (WHERE type = 'dispute' AND deleted_at IS NULL) AS disputes
  FROM observation_reactions WHERE observation_id = o.id
) r ON true
WHERE s.is_active;
