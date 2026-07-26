import { describe, expect, it } from "vitest";
import {
  buildDescription,
  mapElement,
  mapTagsToType,
  parseElevation,
} from "./osm";

// Locks the tag → source_type mapping from DATA_SOURCES.md.
describe("mapTagsToType", () => {
  it("maps each documented tag", () => {
    expect(mapTagsToType({ natural: "spring" })).toBe("spring");
    expect(mapTagsToType({ amenity: "drinking_water" })).toBe("drinking_water");
    expect(mapTagsToType({ amenity: "fountain" })).toBe("fountain");
    expect(mapTagsToType({ man_made: "water_tap" })).toBe("drinking_water");
    expect(mapTagsToType({ man_made: "water_well" })).toBe("other");
  });

  it("prefers drinking_water over spring when both are tagged", () => {
    expect(
      mapTagsToType({ natural: "spring", amenity: "drinking_water" }),
    ).toBe("drinking_water");
  });

  it("returns null for unrelated tags", () => {
    expect(mapTagsToType({ natural: "peak" })).toBeNull();
    expect(mapTagsToType({})).toBeNull();
  });
});

describe("parseElevation", () => {
  it("parses plain and decimal meters", () => {
    expect(parseElevation("1234")).toBe(1234);
    expect(parseElevation("1234.6")).toBe(1235);
    expect(parseElevation("1234,5")).toBe(1235);
    expect(parseElevation("1234 m")).toBe(1234);
  });

  it("rejects garbage", () => {
    expect(parseElevation(undefined)).toBeNull();
    expect(parseElevation("high")).toBeNull();
    expect(parseElevation("")).toBeNull();
  });
});

describe("buildDescription", () => {
  it("combines description, note and seasonal flags", () => {
    expect(
      buildDescription({
        description: "Abreuvoir",
        note: "10 min hors sentier",
        seasonal: "yes",
      }),
    ).toBe("Abreuvoir — 10 min hors sentier — OSM: seasonal=yes");
  });

  it("deduplicates identical description/note", () => {
    expect(buildDescription({ description: "x", note: "x" })).toBe("x");
  });

  it("returns null when nothing useful", () => {
    expect(buildDescription({})).toBeNull();
  });
});

describe("mapElement", () => {
  it("maps a spring node", () => {
    expect(
      mapElement({
        type: "node",
        id: 123,
        lat: 44.9,
        lon: 5.4,
        tags: { natural: "spring", name: "Fontaine de Chaumailloux", ele: "1580" },
      }),
    ).toEqual({
      osmType: "node",
      osmId: 123,
      lat: 44.9,
      lon: 5.4,
      type: "spring",
      name: "Fontaine de Chaumailloux",
      elevationM: 1580,
      description: null,
    });
  });

  it("skips non-nodes and unmappable tags", () => {
    expect(mapElement({ type: "way", id: 1 })).toBeNull();
    expect(
      mapElement({ type: "node", id: 2, lat: 45, lon: 5.4, tags: {} }),
    ).toBeNull();
  });
});
