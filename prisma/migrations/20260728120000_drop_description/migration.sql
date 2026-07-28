-- Drop the OSM-seeded free-text column. The app answers "can I trust this
-- source?" from its own observations only; undated, unattributed OSM claims
-- shown next to them blurred where that answer comes from (DATA_SOURCES.md).
-- Nothing is lost: the tags remain in OSM, which stays the catalog's origin.
ALTER TABLE water_sources DROP COLUMN "description";
