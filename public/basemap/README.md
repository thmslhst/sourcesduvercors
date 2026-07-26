# Vercors basemap (PMTiles)

`vercors.pmtiles` is a Protomaps basemap extract (OpenStreetMap-derived,
© OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright);
build by [Protomaps](https://protomaps.com)). Served as a static file and read
via HTTP range requests — no tile server (ARCHITECTURE.md). From Phase 3 this
same file is the offline basemap download.

Regenerate from the latest daily build (bbox = source catalog + margin;
keep `VERCORS_MAX_BOUNDS` in `components/SourcesMap.tsx` in sync):

```bash
pmtiles extract https://build.protomaps.com/$(date +%Y%m%d).pmtiles \
  public/basemap/vercors.pmtiles --bbox=4.94,44.55,5.91,45.39 --maxzoom=14
```
