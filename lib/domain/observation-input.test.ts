import { describe, expect, it } from "vitest";
import { parseObservationInput } from "./observation-input";

const NOW = new Date("2026-07-26T12:00:00.000Z");
const VALID = {
  id: "3f2f9c1e-8b1a-4d5e-9c3b-2a1f0e9d8c7b",
  sourceId: "A0B1C2D3-E4F5-4a6b-8c9d-0e1f2a3b4c5d",
  status: "flowing",
  observedAt: "2026-07-26T11:30:00.000Z",
};

describe("parseObservationInput", () => {
  it("accepts a valid submission and lowercases UUIDs", () => {
    const r = parseObservationInput({ ...VALID, tags: ["cloudy_water"] }, NOW);
    expect(r).toMatchObject({
      ok: true,
      value: {
        id: VALID.id,
        sourceId: VALID.sourceId.toLowerCase(),
        status: "flowing",
        tags: ["cloudy_water"],
        observedAt: new Date(VALID.observedAt),
      },
    });
  });

  it("rejects non-object bodies", () => {
    expect(parseObservationInput(null, NOW)).toEqual({
      ok: false,
      error: "invalid_body",
    });
    expect(parseObservationInput("x", NOW).ok).toBe(false);
  });

  it("rejects malformed UUIDs", () => {
    expect(parseObservationInput({ ...VALID, id: "nope" }, NOW)).toEqual({
      ok: false,
      error: "invalid_id",
    });
    expect(
      parseObservationInput({ ...VALID, sourceId: "nope" }, NOW),
    ).toEqual({ ok: false, error: "invalid_source_id" });
  });

  it("rejects statuses outside the stored scale — `unknown` included", () => {
    for (const status of ["unknown", "wet", "", 3]) {
      expect(parseObservationInput({ ...VALID, status }, NOW)).toEqual({
        ok: false,
        error: "invalid_status",
      });
    }
  });

  it("treats absent, null and empty tags alike", () => {
    for (const tags of [undefined, null, []]) {
      const r = parseObservationInput({ ...VALID, tags }, NOW);
      expect(r.ok && r.value.tags).toEqual([]);
    }
  });

  it("rejects tags outside the closed vocabulary", () => {
    for (const tags of [
      ["not_a_tag"],
      ["cloudy_water", "not_a_tag"],
      [3],
      "cloudy_water",
      {},
    ]) {
      expect(parseObservationInput({ ...VALID, tags }, NOW)).toEqual({
        ok: false,
        error: "invalid_tags",
      });
    }
  });

  it("deduplicates tags into vocabulary order, not tap order", () => {
    const r = parseObservationInput(
      {
        ...VALID,
        tags: ["broken_fixture", "cloudy_water", "broken_fixture"],
      },
      NOW,
    );
    expect(r.ok && r.value.tags).toEqual(["cloudy_water", "broken_fixture"]);
  });

  it("clamps a future observed_at to now (client clock skew)", () => {
    const r = parseObservationInput(
      { ...VALID, observedAt: "2026-07-26T13:00:00.000Z" },
      NOW,
    );
    expect(r.ok && r.value.observedAt).toEqual(NOW);
  });

  it("clamps observed_at older than 7 days to the window floor", () => {
    const r = parseObservationInput(
      { ...VALID, observedAt: "2026-06-01T00:00:00.000Z" },
      NOW,
    );
    expect(r.ok && r.value.observedAt).toEqual(
      new Date("2026-07-19T12:00:00.000Z"),
    );
  });

  it("rejects unparsable observed_at", () => {
    expect(
      parseObservationInput({ ...VALID, observedAt: "yesterday" }, NOW),
    ).toEqual({ ok: false, error: "invalid_observed_at" });
    expect(
      parseObservationInput({ ...VALID, observedAt: undefined }, NOW),
    ).toEqual({ ok: false, error: "invalid_observed_at" });
  });
});
