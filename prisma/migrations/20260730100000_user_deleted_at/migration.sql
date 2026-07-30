-- Account deletion is anonymisation, not erasure. Observations and reactions
-- are append-only and referenced by other users' reactions and by the derived
-- status, so the user row cannot be hard-deleted (the FKs are RESTRICT, and
-- cascading would revert confirmed statuses to 'unknown' for everyone else).
--
-- Instead the personal data on the row is destroyed — email overwritten with
-- an unusable address, name blanked, sessions and accounts dropped — and this
-- column records that it happened. What survives is an observation keyed to an
-- opaque id, which is no longer personal data (DOMAIN.md § Users & trust).
ALTER TABLE "user" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
