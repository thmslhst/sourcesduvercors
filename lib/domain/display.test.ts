import { describe, expect, it } from "vitest";
import { deriveDisplayStatus, STATUS_COLORS } from "./display";
import { CONFIDENCE_LEVELS, OBSERVATION_STATUSES } from "./constants";

describe("deriveDisplayStatus", () => {
  it("returns unknown when there is no stored status", () => {
    for (const confidence of CONFIDENCE_LEVELS) {
      expect(deriveDisplayStatus(null, confidence)).toBe("unknown");
    }
  });

  it("never shows a stale status once confidence has decayed to unknown", () => {
    for (const status of OBSERVATION_STATUSES) {
      expect(deriveDisplayStatus(status, "unknown")).toBe("unknown");
    }
  });

  it("passes the stored status through at any known confidence", () => {
    for (const status of OBSERVATION_STATUSES) {
      for (const confidence of ["high", "medium", "low"] as const) {
        expect(deriveDisplayStatus(status, confidence)).toBe(status);
      }
    }
  });
});

describe("STATUS_COLORS", () => {
  it("covers every display status", () => {
    for (const status of [...OBSERVATION_STATUSES, "unknown"] as const) {
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
