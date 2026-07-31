-- Rework the observation tag vocabulary (DOMAIN.md § Observation).
--
-- The July set had a tag nobody could act on and one that meant three things:
--   * wrong_location was a maintenance report filed into a product with no
--     maintenance path — no edit flow, no moderation queue — and whoever taps
--     it has already found the source, so it helps nobody downstream.
--   * hard_access conflated hard to *reach* (terrain — a navigation app's job),
--     hard to *find* (the pin isn't where the water is) and hard to *use*.
-- Both collapse into hard_to_find, which is the part a reader acts on: budget
-- time, look around. And hard_to_fill fills the gap the status scale can't —
-- water flowing fine that you still can't get a bottle under (a seep, a trough
-- with no spout, a pipe flush with the rock). That is geometry, not slowness;
-- slowness is already low_flow / dripping.
--
-- Postgres can't drop enum values, so the type is swapped. Unlike the previous
-- tag migration, source_current_status does NOT need dropping: that migration
-- narrowed its LATERAL join to (id, status, observed_at), so the view no longer
-- depends on observations.tags at all. Tags still feed nothing derived.
CREATE TYPE observation_tag_new AS ENUM (
  'hard_to_find',
  'hard_to_fill',
  'out_of_order',
  'cloudy_water'
);

-- Swapped through a second column rather than ALTER COLUMN ... TYPE ... USING,
-- because remapping an array needs a subquery and Postgres rejects subqueries
-- in a transform expression (SQLSTATE 0A000). An UPDATE accepts one. The
-- column ends up last in the table; nothing reads observations with SELECT *
-- (the view was narrowed in 20260730110000), so the order is immaterial.
ALTER TABLE observations
  ADD COLUMN tags_new observation_tag_new[] NOT NULL DEFAULT '{}';

-- hard_access and wrong_location both land on hard_to_find, so an observation
-- carrying the pair would come out duplicated without the DISTINCT. ORDER BY 1
-- sorts by the new enum's declaration order — the same order the shared
-- vocabulary produces (lib/domain/observation-input.ts), so rewritten rows and
-- freshly written ones agree.
UPDATE observations
   SET tags_new = ARRAY(
     SELECT DISTINCT CASE t
       WHEN 'hard_access'    THEN 'hard_to_find'
       WHEN 'wrong_location' THEN 'hard_to_find'
       WHEN 'broken_fixture' THEN 'out_of_order'
       WHEN 'cloudy_water'   THEN 'cloudy_water'
     END::observation_tag_new
     FROM unnest(tags) AS t
     ORDER BY 1
   )
 WHERE tags <> '{}';

ALTER TABLE observations DROP COLUMN tags;
ALTER TABLE observations RENAME COLUMN tags_new TO tags;

DROP TYPE observation_tag;
ALTER TYPE observation_tag_new RENAME TO observation_tag;
