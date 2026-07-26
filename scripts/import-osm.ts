/**
 * OSM → water_sources import (DATA_SOURCES.md).
 *
 * Usage:
 *   npm run import:osm -- --dry-run          fetch + report, no database
 *   npm run import:osm                        fetch + upsert into DATABASE_URL
 *   npm run import:osm -- --from-file=f.json  use a saved Overpass response
 *
 * Upserts are keyed on (osm_type, osm_id); curated fields are never
 * overwritten. Disappeared OSM elements are reported for manual review,
 * never auto-deactivated.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { OVERPASS_QUERY, mapElement, type OverpassElement } from "./osm";

const OVERPASS_URL =
  process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

// Rough Vercors bounding box (park + 5 km buffer) for sanity checking.
const VERCORS_BBOX = { minLat: 44.6, maxLat: 45.4, minLon: 5.0, maxLon: 5.9 };

async function fetchOverpass(): Promise<{ elements: OverpassElement[] }> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass etiquette: identify the client (some mirrors reject blank UAs)
      "User-Agent": "sources-du-vercors-import/0.1 (github.com/sourcesduvercors)",
    },
    body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
  });
  if (!res.ok) {
    throw new Error(`Overpass request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as { elements: OverpassElement[] };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fromFile = args
    .find((a) => a.startsWith("--from-file="))
    ?.split("=")[1];
  const saveTo = args.find((a) => a.startsWith("--save-to="))?.split("=")[1];

  const data = fromFile
    ? (JSON.parse(readFileSync(fromFile, "utf8")) as {
        elements: OverpassElement[];
      })
    : await fetchOverpass();
  if (saveTo) {
    writeFileSync(saveTo, JSON.stringify(data));
    console.log(`Saved raw Overpass response to ${saveTo}`);
  }

  const sources = data.elements
    .map(mapElement)
    .filter((s) => s !== null);
  const skipped = data.elements.length - sources.length;

  // Sanity checks
  const outOfBbox = sources.filter(
    (s) =>
      s.lat < VERCORS_BBOX.minLat ||
      s.lat > VERCORS_BBOX.maxLat ||
      s.lon < VERCORS_BBOX.minLon ||
      s.lon > VERCORS_BBOX.maxLon,
  );
  const byType = new Map<string, number>();
  for (const s of sources) byType.set(s.type, (byType.get(s.type) ?? 0) + 1);

  console.log(`Overpass elements: ${data.elements.length}`);
  console.log(`Importable sources: ${sources.length} (skipped ${skipped})`);
  for (const [type, n] of [...byType].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(15)} ${n}`);
  }
  console.log(`Named: ${sources.filter((s) => s.name).length}`);
  console.log(`With elevation: ${sources.filter((s) => s.elevationM).length}`);
  if (outOfBbox.length > 0) {
    console.warn(`WARNING: ${outOfBbox.length} sources outside Vercors bbox`);
    for (const s of outOfBbox.slice(0, 10)) {
      console.warn(`  ${s.osmType}/${s.osmId} at ${s.lat},${s.lon}`);
    }
  }

  if (dryRun) {
    console.log("Dry run — database untouched.");
    return;
  }

  // DB work only from here, so --dry-run needs no DATABASE_URL.
  const { upsertOsmSource, listOsmRefs } = await import(
    "../lib/db/water-sources"
  );
  const { prisma } = await import("../lib/db/client");

  const before = await listOsmRefs();
  let inserted = 0;
  let updated = 0;
  for (const s of sources) {
    if ((await upsertOsmSource(s)) === "inserted") inserted++;
    else updated++;
  }
  console.log(`Inserted ${inserted}, updated ${updated}.`);

  const fetchedIds = new Set(sources.map((s) => `${s.osmType}/${s.osmId}`));
  const disappeared = before.filter(
    (r) => !fetchedIds.has(`${r.osmType}/${r.osmId}`),
  );
  if (disappeared.length > 0) {
    console.warn(
      `REVIEW: ${disappeared.length} catalog sources no longer in OSM ` +
        `(not auto-deactivated — observations may prove they still exist):`,
    );
    for (const r of disappeared) {
      console.warn(`  ${r.osmType}/${r.osmId} ${r.name ?? "(unnamed)"}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
