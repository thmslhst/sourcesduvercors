/**
 * Pure OSM → catalog mapping logic for the import script (DATA_SOURCES.md).
 * No IO here — keeps the tag mapping unit-testable.
 */

import type { SourceType } from "../lib/domain/constants";

/** Overpass query scoped to the Vercors park boundary (DATA_SOURCES.md). */
export const OVERPASS_QUERY = `
[out:json][timeout:120];
area["boundary"="protected_area"]["name"="Parc naturel régional du Vercors"]->.a;
(
  node["natural"="spring"](area.a);
  node["amenity"="drinking_water"](area.a);
  node["amenity"="fountain"](area.a);
  node["man_made"="water_tap"](area.a);
  node["man_made"="water_well"](area.a);
);
out body;
`.trim();

export interface OverpassElement {
  type: string; // 'node' | 'way' | 'relation'
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export interface CatalogSource {
  osmType: string;
  osmId: number;
  lat: number;
  lon: number;
  type: SourceType;
  name: string | null;
  elevationM: number | null;
  description: string | null;
}

/**
 * Tag → source_type mapping (DATA_SOURCES.md). Precedence favors the most
 * actionable type for a hiker when several tags coexist: a spring that is
 * also tagged drinking_water is best surfaced as drinking_water.
 */
export function mapTagsToType(
  tags: Record<string, string>,
): SourceType | null {
  if (tags.amenity === "drinking_water") return "drinking_water";
  if (tags.man_made === "water_tap") return "drinking_water";
  if (tags.amenity === "fountain") return "fountain";
  if (tags.natural === "spring") return "spring";
  if (tags.man_made === "water_well") return "other";
  return null;
}

/** Parse OSM ele=* ("1234", "1234.5", "1 234 m") to integer meters. */
export function parseElevation(ele: string | undefined): number | null {
  if (!ele) return null;
  const match = ele.replace(/\s|m$/gi, "").replace(",", ".").match(/^-?\d+(\.\d+)?$/);
  if (!match) return null;
  return Math.round(parseFloat(match[0]));
}

/**
 * Seed the curated description from OSM description/note tags, plus
 * seasonal/intermittent context when present (DATA_SOURCES.md).
 * Curated edits are never overwritten on re-import.
 */
export function buildDescription(
  tags: Record<string, string>,
): string | null {
  const parts: string[] = [];
  if (tags.description) parts.push(tags.description);
  if (tags.note && tags.note !== tags.description) parts.push(tags.note);
  const flags = ["seasonal", "intermittent"]
    .filter((k) => tags[k])
    .map((k) => `${k}=${tags[k]}`);
  if (flags.length > 0) parts.push(`OSM: ${flags.join(", ")}`);
  return parts.length > 0 ? parts.join(" — ") : null;
}

/** Map one Overpass element to a catalog row; null when not importable. */
export function mapElement(el: OverpassElement): CatalogSource | null {
  if (el.type !== "node" || el.lat === undefined || el.lon === undefined) {
    return null;
  }
  const tags = el.tags ?? {};
  const type = mapTagsToType(tags);
  if (type === null) return null;
  return {
    osmType: el.type,
    osmId: el.id,
    lat: el.lat,
    lon: el.lon,
    type,
    name: tags.name ?? null,
    elevationM: parseElevation(tags.ele),
    description: buildDescription(tags),
  };
}
