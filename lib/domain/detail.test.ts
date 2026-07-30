import { describe, expect, it } from "vitest";

import { CONFIDENCE_WINDOWS_DAYS } from "./constants";
import { deriveConfidence } from "./confidence";
import { isConfirmWorthPromoting } from "./detail";
import type { ObservationHistoryItem } from "./detail";

const NOW = new Date("2026-07-30T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function observation(
  over: Partial<ObservationHistoryItem> = {},
): ObservationHistoryItem {
  return {
    id: "3f2f9c1e-8b1a-4d5e-9c3b-2a1f0e9d8c7b",
    status: "flowing",
    tags: [],
    observedAt: daysAgo(1),
    confirmationCount: 0,
    disputeCount: 0,
    isMine: false,
    myReaction: null,
    ...over,
  };
}

describe("isConfirmWorthPromoting", () => {
  it("promotes a fresh observation from someone else", () => {
    expect(isConfirmWorthPromoting(observation(), NOW)).toBe(true);
  });

  it("never promotes your own observation", () => {
    expect(isConfirmWorthPromoting(observation({ isMine: true }), NOW)).toBe(
      false,
    );
  });

  it("never promotes when the viewer already reacted", () => {
    for (const myReaction of ["confirm", "dispute"] as const) {
      expect(isConfirmWorthPromoting(observation({ myReaction }), NOW)).toBe(
        false,
      );
    }
  });

  it("stops at the edge of the high window", () => {
    const { high } = CONFIDENCE_WINDOWS_DAYS;
    expect(
      isConfirmWorthPromoting(observation({ observedAt: daysAgo(high) }), NOW),
    ).toBe(true);
    expect(
      isConfirmWorthPromoting(
        observation({ observedAt: daysAgo(high + 0.01) }),
        NOW,
      ),
    ).toBe(false);
  });

  /**
   * The point of the gate: past the boundary a confirmation cannot change
   * the derived confidence, so promoting it would promise something the
   * model won't deliver. If this fails, the CTA and the derivation have
   * drifted apart — fix the gate, not the test.
   */
  it("is promoted exactly when a confirmation could raise confidence", () => {
    for (const ageDays of [0, 1, 6.9, 7, 7.1, 20, 59]) {
      const withoutConfirm = deriveConfidence({
        ageDays,
        confirmations: 0,
        disputes: 0,
      });
      const withConfirm = deriveConfidence({
        ageDays,
        confirmations: 1,
        disputes: 0,
      });
      const changesConfidence = withoutConfirm !== withConfirm;
      expect(
        isConfirmWorthPromoting(
          observation({ observedAt: daysAgo(ageDays) }),
          NOW,
        ),
      ).toBe(changesConfidence);
    }
  });
});
