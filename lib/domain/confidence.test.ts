import { describe, expect, it } from "vitest";
import { deriveConfidence } from "./confidence";

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
