"use client";

/**
 * Full-screen MapLibre map of the Vercors water sources.
 *
 * Basemap: local PMTiles extract (public/basemap/vercors.pmtiles) styled
 * with @protomaps/basemaps — no tile server, range requests only
 * (ARCHITECTURE.md). Sources are drawn as circles colored by display
 * status with a white per-type icon on top.
 */

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  GeolocateControl,
  addProtocol,
  removeProtocol,
} from "maplibre-gl";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  MapGeoJSONFeature,
  MapMouseEvent,
  StyleSpecification,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import "maplibre-gl/dist/maplibre-gl.css";

import { SOURCE_TYPES, type SourceType } from "@/lib/domain/constants";
import { STATUS_COLORS } from "@/lib/domain/display";
import type { SourceSnapshotItem } from "@/lib/domain/snapshot";
import { fr } from "@/lib/i18n/fr";

/** Extract bbox of public/basemap/vercors.pmtiles — keep in sync. */
const VERCORS_MAX_BOUNDS: [number, number, number, number] = [
  4.94, 44.55, 5.91, 45.39,
];
/** Bbox of the imported catalog, used for the initial view. */
const SOURCES_BOUNDS: [number, number, number, number] = [
  5.04, 44.65, 5.81, 45.29,
];

const BASEMAP_ASSETS = "https://protomaps.github.io/basemaps-assets";

/** White glyphs drawn on top of the status-colored circle, one per type. */
const TYPE_ICON_SVGS: Record<SourceType, string> = {
  spring: '<path d="M12 2C8.5 7.5 5 11.5 5 15.5a7 7 0 0 0 14 0C19 11.5 15.5 7.5 12 2Z"/>',
  drinking_water: '<path d="M7 3h10l-1.4 18H8.4L7 3Z"/>',
  fountain:
    '<rect x="4" y="17" width="16" height="4" rx="1.5"/><rect x="11" y="6" width="2" height="11"/><path d="M12 6c0-2.5 4.5-2.5 4.5 1M12 6c0-2.5-4.5-2.5-4.5 1" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>',
  cistern:
    '<rect x="4" y="5" width="16" height="12" rx="3"/><rect x="6" y="17" width="3" height="3"/><rect x="15" y="17" width="3" height="3"/>',
  stream:
    '<path d="M4 7.5c2.5-2 5.5-2 8 0s5.5 2 8 0M4 12.5c2.5-2 5.5-2 8 0s5.5 2 8 0M4 17.5c2.5-2 5.5-2 8 0s5.5 2 8 0" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  other: '<circle cx="12" cy="12" r="4"/>',
};

function iconDataUrl(svgContent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white">${svgContent}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadTypeIcons(map: MapLibreMap): Promise<void> {
  await Promise.all(
    SOURCE_TYPES.map(
      (type) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image(30, 30);
          img.onload = () => {
            if (!map.hasImage(`type-${type}`)) {
              map.addImage(`type-${type}`, img, { pixelRatio: 2 });
            }
            resolve();
          };
          img.onerror = () => reject(new Error(`icon failed: ${type}`));
          img.src = iconDataUrl(TYPE_ICON_SVGS[type]);
        }),
    ),
  );
}

function toGeoJSON(
  sources: SourceSnapshotItem[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: sources.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: { id: s.id, type: s.type, status: s.status },
    })),
  };
}

/** Data-driven circle color: match on the (already derived) display status. */
const STATUS_COLOR_EXPRESSION: ExpressionSpecification = [
  "match",
  ["get", "status"],
  "flowing", STATUS_COLORS.flowing,
  "low_flow", STATUS_COLORS.low_flow,
  "dripping", STATUS_COLORS.dripping,
  "dry", STATUS_COLORS.dry,
  STATUS_COLORS.unknown,
];

interface SourcesMapProps {
  sources: SourceSnapshotItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function SourcesMap({
  sources,
  selectedId,
  onSelect,
}: SourcesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapReadyRef = useRef(false);
  const sourcesRef = useRef(sources);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    sourcesRef.current = sources;
    onSelectRef.current = onSelect;
  }, [sources, onSelect]);

  useEffect(() => {
    if (!containerRef.current) return;

    const protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);

    const style: StyleSpecification = {
      version: 8,
      glyphs: `${BASEMAP_ASSETS}/fonts/{fontstack}/{range}.pbf`,
      sprite: `${BASEMAP_ASSETS}/sprites/v4/light`,
      sources: {
        protomaps: {
          type: "vector",
          url: `pmtiles://${window.location.origin}/basemap/vercors.pmtiles`,
          attribution: fr.mapAttribution,
        },
      },
      layers: layers("protomaps", namedFlavor("light"), { lang: "fr" }),
    };

    const map = new MapLibreMap({
      container: containerRef.current,
      style,
      bounds: SOURCES_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      maxBounds: VERCORS_MAX_BOUNDS,
      minZoom: 7,
      maxZoom: 17,
      // Not compact: the credit stays visible instead of collapsing behind
      // an "(i)" toggle. The OSMF attribution guideline only allows hiding
      // it when it remains reachable — always-on is simpler and honest.
      // The full credit (Protomaps, ODbL, MIT) lives in the about card.
      attributionControl: { compact: false },
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __map?: MapLibreMap }).__map = map;
    }

    map.addControl(new NavigationControl({ showCompass: false }));
    // Geolocation is client-side only: used to center the map, never sent
    // to the server (ARCHITECTURE.md § Privacy).
    map.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
      }),
    );

    map.on("load", async () => {
      await loadTypeIcons(map);

      map.addSource("water-sources", {
        type: "geojson",
        data: toGeoJSON(sourcesRef.current),
      });

      // Selection ring, under the dots.
      map.addLayer({
        id: "sources-selected",
        type: "circle",
        source: "water-sources",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            8, 8, 11, 13, 14, 17,
          ],
          "circle-color": "#00000000",
          "circle-stroke-color": "#4D794E",
          "circle-stroke-width": 2.5,
        },
      });

      map.addLayer({
        id: "sources-circles",
        type: "circle",
        source: "water-sources",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            8, 3.5, 11, 8, 14, 12,
          ],
          "circle-color": STATUS_COLOR_EXPRESSION,
          "circle-stroke-color": "#FAFAFA",
          "circle-stroke-width": 1.5,
        },
      });

      map.addLayer({
        id: "sources-icons",
        type: "symbol",
        source: "water-sources",
        minzoom: 10.5,
        layout: {
          "icon-image": ["concat", "type-", ["get", "type"]],
          "icon-size": [
            "interpolate", ["linear"], ["zoom"],
            10.5, 0.55, 14, 0.9,
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      mapReadyRef.current = true;

      // Tap handling with a small hit box — fingers are not cursors.
      map.on("click", (e: MapMouseEvent) => {
        const pad = 10;
        const features: MapGeoJSONFeature[] = map.queryRenderedFeatures(
          [
            [e.point.x - pad, e.point.y - pad],
            [e.point.x + pad, e.point.y + pad],
          ],
          { layers: ["sources-circles"] },
        );
        onSelectRef.current(
          features.length > 0 ? String(features[0].properties.id) : null,
        );
      });
      map.on("mouseenter", "sources-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "sources-circles", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      mapReadyRef.current = false;
      mapRef.current = null;
      map.remove();
      removeProtocol("pmtiles");
    };
  }, []);

  // Refresh data when the snapshot changes (initial fetch resolves after load).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const src = map.getSource<GeoJSONSource>("water-sources");
    src?.setData(toGeoJSON(sources));
  }, [sources]);

  // Reflect selection in the highlight ring.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    map.setFilter("sources-selected", ["==", ["get", "id"], selectedId ?? ""]);
  }, [selectedId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
