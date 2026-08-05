-- Retire the dispute ("Signaler obsolète") reaction from the confidence model.
--
-- A dispute capped the latest observation's confidence at 'low'. It bought a
-- few weeks' head start on a downgrade that age already performs — an
-- unconfirmed observation is 'medium' at best and 'low' by day 21 — and the
-- product had already conceded the point: the sheet hoists confirm into a CTA
-- while telling the hiker that if the source has changed, the useful
-- contribution is a fresh observation, not a "-1".
--
-- Two things it did badly justify removing it rather than fixing it:
--   * The snapshot never carried dispute counts, so a disputed source kept
--     showing its cached higher confidence to offline hikers — the one moment
--     the warning mattered (DOMAIN.md § Confidence model, offline-first).
--   * Because of that, the client couldn't re-run the derivation and had to
--     approximate it with an age cap. Dropping disputes leaves age +
--     confirmations, both of which the snapshot already carries, so server and
--     client now run the *same* function (lib/domain/confidence.ts).
--
-- Existing dispute rows and the 'dispute' value of reaction_type are left in
-- place: observations are append-only, the rows are historical record, and
-- nothing reads them once this view stops counting them. The API and UI no
-- longer produce them.
--
-- The view has to be dropped and recreated because dispute_count is one of its
-- output columns. Nothing selects that column (lib/db/sources-snapshot.ts
-- reads status/confidence/last_observed_at/confirmation_count; the per-
-- observation counts in lib/db/observations.ts come from the reactions table),
-- so this is safe to apply either side of the code deploy.
DROP VIEW source_current_status;

-- Verbatim re-creation of the view (prisma/migrations/20260730110000_
-- observation_tags) minus the dispute_count column, the disputes branch of the
-- CASE, and the disputes tally in the reaction LATERAL. The day-window
-- constants (7/21/60) are still mirrored in lib/domain/constants.ts — change
-- them in both places or not at all.
CREATE VIEW "source_current_status" AS
SELECT
  s.id AS source_id,
  o.status,                                   -- NULL → 'unknown' in API layer
  o.observed_at AS last_observed_at,
  COALESCE(r.confirms, 0)  AS confirmation_count,
  CASE
    WHEN o.id IS NULL OR o.observed_at < now() - interval '60 days' THEN 'unknown'
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
    count(*) FILTER (WHERE type = 'confirm' AND deleted_at IS NULL) AS confirms
  FROM observation_reactions WHERE observation_id = o.id
) r ON true
WHERE s.is_active;
