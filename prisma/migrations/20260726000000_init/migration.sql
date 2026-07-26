-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "source_type" AS ENUM ('spring', 'fountain', 'drinking_water', 'cistern', 'stream', 'other');

-- CreateEnum
CREATE TYPE "observation_status" AS ENUM ('flowing', 'low_flow', 'dripping', 'dry');

-- CreateEnum
CREATE TYPE "reaction_type" AS ENUM ('confirm', 'dispute');

-- CreateTable
CREATE TABLE "water_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region" TEXT NOT NULL DEFAULT 'vercors',
    "name" TEXT,
    "type" "source_type" NOT NULL,
    "geom" geometry(Point, 4326) NOT NULL,
    "elevation_m" INTEGER,
    "description" TEXT,
    "osm_type" TEXT,
    "osm_id" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "observation_status" NOT NULL,
    "comment" TEXT,
    "photo_url" TEXT,
    "observed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_reactions" (
    "id" UUID NOT NULL,
    "observation_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "reaction_type" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "observation_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(6),
    "refreshTokenExpiresAt" TIMESTAMPTZ(6),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "water_sources_osm_type_osm_id_key" ON "water_sources"("osm_type", "osm_id");

-- CreateIndex
CREATE UNIQUE INDEX "observation_reactions_observation_id_user_id_key" ON "observation_reactions"("observation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "water_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_reactions" ADD CONSTRAINT "observation_reactions_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_reactions" ADD CONSTRAINT "observation_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written additions (Prisma cannot express these) — see DATABASE.md.
-- If `prisma migrate dev` ever reports drift on these objects, keep them.
-- ---------------------------------------------------------------------------

-- Spatial index for bbox / nearest-source queries
CREATE INDEX "water_sources_geom_idx" ON "water_sources" USING gist ("geom");

-- Active sources per region
CREATE INDEX "water_sources_region_idx" ON "water_sources" ("region") WHERE "is_active";

-- Latest non-deleted observation per source (drives source_current_status)
CREATE INDEX "observations_source_latest_idx"
  ON "observations" ("source_id", "observed_at" DESC) WHERE "deleted_at" IS NULL;

-- Better Auth lookup indexes
CREATE INDEX "session_userId_idx" ON "session" ("userId");
CREATE INDEX "account_userId_idx" ON "account" ("userId");

-- ---------------------------------------------------------------------------
-- Derived status view — THE single source of truth for what the map shows.
-- Rules from DOMAIN.md; the day-window constants (7 / 21 / 60) are mirrored
-- in lib/domain/constants.ts. Change them in both places or not at all.
-- ---------------------------------------------------------------------------

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
  SELECT * FROM observations
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
