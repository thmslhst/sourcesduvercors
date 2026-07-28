/**
 * Geo queries for water_sources. Raw SQL involving PostGIS geometry lives
 * here and nowhere else (ARCHITECTURE.md).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./client";
import type { CatalogSource } from "../../scripts/osm";

export type UpsertResult = "inserted" | "updated";

/**
 * Upsert an OSM-imported source keyed on (osm_type, osm_id) — DATA_SOURCES.md.
 * On conflict only geometry and updated_at are refreshed: curated fields
 * (name fixes, is_active) are never overwritten on re-import.
 */
export async function upsertOsmSource(
  s: CatalogSource,
): Promise<UpsertResult> {
  const rows = await prisma.$queryRaw<{ inserted: boolean }[]>`
    INSERT INTO water_sources
      (type, geom, name, elevation_m, osm_type, osm_id)
    VALUES (
      ${s.type}::source_type,
      ST_SetSRID(ST_MakePoint(${s.lon}, ${s.lat}), 4326),
      ${s.name},
      ${s.elevationM},
      ${s.osmType},
      ${s.osmId}
    )
    ON CONFLICT (osm_type, osm_id) DO UPDATE SET
      geom = EXCLUDED.geom,
      updated_at = now()
    RETURNING (xmax = 0) AS inserted
  `;
  return rows[0]?.inserted ? "inserted" : "updated";
}

/** OSM refs currently in the catalog, to flag disappeared elements. */
export async function listOsmRefs(): Promise<
  { osmType: string; osmId: bigint; name: string | null }[]
> {
  const rows = await prisma.$queryRaw<
    { osm_type: string; osm_id: bigint; name: string | null }[]
  >(Prisma.sql`
    SELECT osm_type, osm_id, name FROM water_sources
    WHERE osm_type IS NOT NULL AND is_active
  `);
  return rows.map((r) => ({
    osmType: r.osm_type,
    osmId: r.osm_id,
    name: r.name,
  }));
}
