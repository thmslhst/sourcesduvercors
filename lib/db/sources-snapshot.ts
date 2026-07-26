/**
 * Snapshot query for `GET /api/v1/sources`. Geometry read (ST_X/ST_Y) lives
 * here with the other raw PostGIS SQL (ARCHITECTURE.md).
 */

import { Prisma } from "@prisma/client";

import { prisma } from "./client";
import type {
  Confidence,
  ObservationStatus,
  SourceType,
} from "../domain/constants";
import { deriveDisplayStatus } from "../domain/display";
import type { SourceSnapshotItem } from "../domain/snapshot";

interface SnapshotRow {
  id: string;
  name: string | null;
  type: SourceType;
  lat: number;
  lon: number;
  elevation_m: number | null;
  description: string | null;
  status: ObservationStatus | null;
  confidence: Confidence;
  last_observed_at: Date | null;
  confirmation_count: bigint | number;
}

async function querySnapshot(where: Prisma.Sql): Promise<SourceSnapshotItem[]> {
  const rows = await prisma.$queryRaw<SnapshotRow[]>`
    SELECT
      s.id,
      s.name,
      s.type::text        AS type,
      ST_Y(s.geom)        AS lat,
      ST_X(s.geom)        AS lon,
      s.elevation_m,
      s.description,
      cs.status::text     AS status,
      cs.confidence,
      cs.last_observed_at,
      cs.confirmation_count
    FROM water_sources s
    JOIN source_current_status cs ON cs.source_id = s.id
    ${where}
    ORDER BY s.id
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    lat: r.lat,
    lon: r.lon,
    elevationM: r.elevation_m,
    description: r.description,
    status: deriveDisplayStatus(r.status, r.confidence),
    confidence: r.confidence,
    lastObservedAt: r.last_observed_at?.toISOString() ?? null,
    confirmationCount: Number(r.confirmation_count),
  }));
}

/**
 * All active sources with derived status, ordered by id for a deterministic
 * payload (the ETag depends on it). `source_current_status` is the single
 * source of truth for status/confidence (DATABASE.md).
 */
export async function listSourcesSnapshot(): Promise<SourceSnapshotItem[]> {
  return querySnapshot(Prisma.empty);
}

/** One active source with derived status; null when absent or delisted. */
export async function getSourceSnapshot(
  id: string,
): Promise<SourceSnapshotItem | null> {
  const items = await querySnapshot(Prisma.sql`WHERE s.id = ${id}::uuid`);
  return items[0] ?? null;
}
