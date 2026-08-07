import { describe, expect, it } from "vitest";
import { decaySnapshotItem, deriveDisplayStatus, STATUS_COLORS } from "./display";
import { CONFIDENCE_LEVELS, OBSERVATION_STATUSES } from "./constants";
import type { SourceSnapshotItem } from "./snapshot";

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

describe("decaySnapshotItem", () => {
  const base: SourceSnapshotItem = {
    id: "3b0f8d2e-0000-4000-8000-000000000000",
    name: "Fontaine de test",
    type: "spring",
    lat: 45,
    lon: 5.4,
    elevationM: 1200,
    status: "flowing",
    confidence: "high",
    lastObservedAt: null,
    confirmationCount: 2,
  };
  const daysAgo = (now: Date, days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  it("returns the item unchanged (same reference) while fresh", () => {
    const now = new Date();
    const item = { ...base, lastObservedAt: daysAgo(now, 3) };
    expect(decaySnapshotItem(item, now)).toBe(item);
  });

  it("degrades a cached high once past the freshness window", () => {
    const now = new Date();
    const item = { ...base, lastObservedAt: daysAgo(now, 10) };
    const decayed = decaySnapshotItem(item, now);
    expect(decayed.confidence).toBe("low");
    expect(decayed.status).toBe("flowing"); // status survives, badge degrades
  });

  it("collapses the status to unknown once past the known window", () => {
    const now = new Date();
    const item = { ...base, lastObservedAt: daysAgo(now, 61) };
    const decayed = decaySnapshotItem(item, now);
    expect(decayed.confidence).toBe("unknown");
    expect(decayed.status).toBe("unknown");
  });
});

describe("STATUS_COLORS", () => {
  it("covers every display status", () => {
    for (const status of [...OBSERVATION_STATUSES, "unknown"] as const) {
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
