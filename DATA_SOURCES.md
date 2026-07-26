# Data Sources & Licensing

Where the water-source catalog comes from, how it is imported, and what the licenses require.

## Primary source: OpenStreetMap

The initial catalog is imported from OSM via the Overpass API, scoped to the Vercors area.

### Area of interest

The Vercors Regional Natural Park boundary exists in OSM as a relation (`boundary=protected_area`, name "Parc naturel régional du Vercors"). Use it (or a slightly buffered bbox around it, ~5 km, to catch approach-trail sources) as the import boundary. Record the exact relation ID in the import script once verified against current OSM data.

### Overpass query (reference)

```
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
```

Expected scale: a few hundred nodes. Streams (`waterway=stream`) are **not** bulk-imported — too noisy; reliable stream crossings get added manually as curated `stream` sources.

### Tag → type mapping (see [DOMAIN.md](DOMAIN.md))

| OSM tags | `source_type` |
|---|---|
| `natural=spring` | `spring` |
| `amenity=drinking_water` | `drinking_water` |
| `amenity=fountain` | `fountain` |
| `man_made=water_tap` | `drinking_water` |
| `man_made=water_well` | `other` |

Also captured when present: `name`, `ele` → `elevation_m`, `description`/`note` → seed for curated `description`, `seasonal`/`intermittent` tags → useful context in description.

## Import & refresh workflow

Script lives in `/scripts` (see repo layout in [ARCHITECTURE.md](ARCHITECTURE.md)):

1. Fetch Overpass result for the boundary.
2. Upsert into `water_sources` keyed on `(osm_type, osm_id)` — see [DATABASE.md](DATABASE.md).
3. Never overwrite curated fields (`description`, `is_active`, manual `name` fixes) on re-import; only geometry, tags-derived fields on new rows, and flag disappeared OSM elements for manual review (don't auto-deactivate — observations may prove the source still exists).
4. Run manually at first; later a monthly scheduled job.

Manual additions (sources known to locals but missing from OSM) get `osm_type = NULL`. Ideally they are *also* contributed upstream to OSM — good citizenship and keeps the catalog convergent.

## Licensing

- **OSM data is ODbL.** Our imported catalog is a derivative database → the catalog itself must remain **ODbL** (share-alike). Attribution "© OpenStreetMap contributors" must appear on the map and on an about page.
- **User observations** are *our* collected data, in a separate database linked to ODbL geometries. Plan: publish observations openly too (aligned with the open-source principle), which sidesteps ODbL boundary questions entirely.
- **Basemap tiles:** Protomaps builds are OSM-derived → same attribution. Any glyph/sprite assets keep their own licenses.
- **Code license:** repository currently ships [LICENSE](LICENSE) (MIT). Code MIT + data ODbL is a standard, compatible combination.

## Other data (evaluated, not used in MVP)

- **Park / IGN / local association water lists** — valuable for cross-checking, but licensing is unclear per source; do not import without explicit permission. A future partnership with the Parc naturel régional du Vercors could change this (see [VISION.md](VISION.md)).
- **Rainfall / Météo-France, DEM elevation services** — post-MVP (predictive features only).
