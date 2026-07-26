import { describe, expect, it } from "vitest";
import { decayConfidence, deriveConfidence } from "./confidence";

// These tests lock the v1 rules from DOMAIN.md. The SQL view
// source_current_status must stay semantically identical.
describe("deriveConfidence", () => {
  it("is unknown with no observation", () => {
    expect(
      deriveConfidence({ ageDays: null, confirmations: 0, disputes: 0 }),
    ).toBe("unknown");
  });

  it("is unknown past 60 days regardless of reactions", () => {
    expect(
      deriveConfidence({ ageDays: 61, confirmations: 5, disputes: 0 }),
    ).toBe("unknown");
  });

  it("caps at low when the latest observation is disputed", () => {
    expect(
      deriveConfidence({ ageDays: 2, confirmations: 3, disputes: 1 }),
    ).toBe("low");
  });

  it("is high when fresh (≤ 7 days) and confirmed", () => {
    expect(
      deriveConfidence({ ageDays: 7, confirmations: 1, disputes: 0 }),
    ).toBe("high");
  });

  it("is medium when fresh but unconfirmed", () => {
    expect(
      deriveConfidence({ ageDays: 3, confirmations: 0, disputes: 0 }),
    ).toBe("medium");
  });

  it("is medium up to 21 days", () => {
    expect(
      deriveConfidence({ ageDays: 21, confirmations: 0, disputes: 0 }),
    ).toBe("medium");
  });

  it("confirmations past 7 days do not raise to high", () => {
    expect(
      deriveConfidence({ ageDays: 10, confirmations: 4, disputes: 0 }),
    ).toBe("medium");
  });

  it("is low between 22 and 60 days", () => {
    expect(
      deriveConfidence({ ageDays: 22, confirmations: 0, disputes: 0 }),
    ).toBe("low");
    expect(
      deriveConfidence({ ageDays: 60, confirmations: 0, disputes: 0 }),
    ).toBe("low");
  });
});

// Offline decay: cap a cached (server-derived) confidence by observation age.
describe("decayConfidence", () => {
  it("keeps fresh data unchanged", () => {
    expect(decayConfidence("high", 2)).toBe("high");
    expect(decayConfidence("medium", 5)).toBe("medium");
  });

  it("never upgrades — a dispute-capped low stays low even when fresh", () => {
    expect(decayConfidence("low", 2)).toBe("low");
    expect(decayConfidence("unknown", 2)).toBe("unknown");
  });

  it("degrades high past the 7-day window", () => {
    expect(decayConfidence("high", 7)).toBe("high");
    expect(decayConfidence("high", 7.5)).toBe("medium");
  });

  it("degrades to low past the 21-day window", () => {
    expect(decayConfidence("high", 22)).toBe("low");
    expect(decayConfidence("medium", 22)).toBe("low");
  });

  it("decays everything to unknown past 60 days", () => {
    expect(decayConfidence("high", 61)).toBe("unknown");
    expect(decayConfidence("low", 61)).toBe("unknown");
  });

  it("is unknown with no observation", () => {
    expect(decayConfidence("unknown", null)).toBe("unknown");
  });

  it("matches deriveConfidence at every boundary when there are no reactions", () => {
    // With 0 confirmations / 0 disputes the age cap and the full derivation
    // agree from `medium` downward — the two rule sets can't drift apart.
    for (const ageDays of [0, 7, 7.1, 21, 21.1, 60, 60.1]) {
      const derived = deriveConfidence({ ageDays, confirmations: 0, disputes: 0 });
      expect(decayConfidence(derived, ageDays)).toBe(derived);
    }
  });
});
