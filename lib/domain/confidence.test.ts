import { describe, expect, it } from "vitest";
import { deriveConfidence } from "./confidence";

// These tests lock the v1 rules from DOMAIN.md. The SQL view
// source_current_status must stay semantically identical — and so must the
// offline path, which since the dispute reaction was retired calls this same
// function over the cached snapshot rather than approximating it.
describe("deriveConfidence", () => {
  it("is unknown with no observation", () => {
    expect(deriveConfidence({ ageDays: null, confirmations: 0 })).toBe(
      "unknown",
    );
  });

  it("is unknown past 60 days regardless of confirmations", () => {
    expect(deriveConfidence({ ageDays: 61, confirmations: 5 })).toBe("unknown");
  });

  it("is high when fresh (≤ 7 days) and confirmed", () => {
    expect(deriveConfidence({ ageDays: 7, confirmations: 1 })).toBe("high");
  });

  it("is medium when fresh but unconfirmed", () => {
    expect(deriveConfidence({ ageDays: 3, confirmations: 0 })).toBe("medium");
  });

  it("is medium up to 21 days", () => {
    expect(deriveConfidence({ ageDays: 21, confirmations: 0 })).toBe("medium");
  });

  it("confirmations past 7 days do not raise to high", () => {
    expect(deriveConfidence({ ageDays: 10, confirmations: 4 })).toBe("medium");
  });

  it("is low between 22 and 60 days", () => {
    expect(deriveConfidence({ ageDays: 22, confirmations: 0 })).toBe("low");
    expect(deriveConfidence({ ageDays: 60, confirmations: 0 })).toBe("low");
  });

  it("only ever degrades as an observation ages", () => {
    // The offline client re-runs this against a moving clock, so the rule has
    // to be monotonic in age or a cached source could appear to regain trust.
    const rank = { high: 3, medium: 2, low: 1, unknown: 0 } as const;
    for (const confirmations of [0, 1, 3]) {
      let previous = rank[deriveConfidence({ ageDays: 0, confirmations })];
      for (const ageDays of [1, 7, 7.1, 20, 21, 21.1, 59, 60, 60.1, 400]) {
        const current = rank[deriveConfidence({ ageDays, confirmations })];
        expect(current).toBeLessThanOrEqual(previous);
        previous = current;
      }
    }
  });
});
