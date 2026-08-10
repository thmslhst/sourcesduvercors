import { describe, expect, it } from "vitest";

import { CONFIDENCE_WINDOWS_DAYS, type Confidence } from "./constants";
import { deriveConfidence } from "./confidence";
import { isDecayed, sourcePromptState } from "./detail";
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
    isMine: false,
    myConfirmation: false,
    ...over,
  };
}

const RANK: Record<Confidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};

describe("isDecayed", () => {
  it("keeps an observation inside the known window in its status color", () => {
    expect(isDecayed(daysAgo(CONFIDENCE_WINDOWS_DAYS.known), NOW)).toBe(false);
  });

  it("greys out an observation past the known window", () => {
    expect(isDecayed(daysAgo(CONFIDENCE_WINDOWS_DAYS.known + 0.01), NOW)).toBe(
      true,
    );
  });

  /**
   * The whole point of the rule: it reads the same constant the confidence
   * derivation does, so a row goes grey exactly when it stops supporting a
   * confidence — never a day either side of it.
   */
  it("greys out exactly the observations that support no confidence", () => {
    for (const ageDays of [0, 1, 7, 30, 59.99, 60, 60.01, 90, 365]) {
      expect(isDecayed(daysAgo(ageDays), NOW)).toBe(
        deriveConfidence({ ageDays, confirmations: 0 }) === "unknown",
      );
    }
  });
});

describe("sourcePromptState", () => {
  it("asks to confirm a fresh observation from someone else", () => {
    expect(sourcePromptState(observation(), NOW)).toBe("confirm");
  });

  it("offers nothing on your own fresh observation", () => {
    expect(sourcePromptState(observation({ isMine: true }), NOW)).toBe("none");
  });

  it("settles once the viewer has confirmed", () => {
    expect(sourcePromptState(observation({ myConfirmation: true }), NOW)).toBe(
      "confirmed",
    );
  });

  it("switches to re-observe at the edge of the freshness window", () => {
    const { medium } = CONFIDENCE_WINDOWS_DAYS;
    expect(
      sourcePromptState(observation({ observedAt: daysAgo(medium) }), NOW),
    ).toBe("confirm");
    expect(
      sourcePromptState(
        observation({ observedAt: daysAgo(medium + 0.01) }),
        NOW,
      ),
    ).toBe("reobserve");
  });

  it("offers re-observe on a stale observation whoever wrote or confirmed it", () => {
    const stale = { observedAt: daysAgo(30) };
    expect(sourcePromptState(observation(stale), NOW)).toBe("reobserve");
    expect(
      sourcePromptState(observation({ ...stale, isMine: true }), NOW),
    ).toBe("reobserve");
    expect(
      sourcePromptState(observation({ ...stale, myConfirmation: true }), NOW),
    ).toBe("reobserve");
  });

  it("offers nothing once the source has gone unknown", () => {
    const { known } = CONFIDENCE_WINDOWS_DAYS;
    expect(
      sourcePromptState(observation({ observedAt: daysAgo(known) }), NOW),
    ).toBe("reobserve");
    expect(
      sourcePromptState(
        observation({ observedAt: daysAgo(known + 0.01) }),
        NOW,
      ),
    ).toBe("none");
  });

  const AGES = [0, 1, 6.9, 7, 7.1, 20, 30, 59, 60, 60.1, 400];

  /**
   * The point of the gate: the prompt may never lead with a confirmation the
   * confidence model won't honour. On an uncorroborated observation — the
   * case where a confirmation is the difference between medium and high —
   * `confirm` has to coincide exactly with "this tap changes the derived
   * confidence". If this fails, the prompt and the derivation have drifted
   * apart; fix the gate, not the test.
   */
  it("asks to confirm exactly while a first confirmation would raise confidence", () => {
    for (const ageDays of AGES) {
      const raises =
        deriveConfidence({ ageDays, confirmations: 1 }) !==
        deriveConfidence({ ageDays, confirmations: 0 });
      expect(
        sourcePromptState(
          observation({ observedAt: daysAgo(ageDays) }),
          NOW,
        ) === "confirm",
      ).toBe(raises);
    }
  });

  /**
   * Corroboration past the first is still worth asking for: it can't lift a
   * source that is already high, but it is a real second voice and the sheet
   * shows it ("confirmé par 3 randonneurs"). What the window governs is the
   * *kind* of ask, not how many people may answer it.
   */
  it("keeps asking on a fresh observation others have already confirmed", () => {
    expect(sourcePromptState(observation({ confirmationCount: 3 }), NOW)).toBe(
      "confirm",
    );
  });

  /**
   * Re-observing files a brand-new, as-yet unconfirmed observation, so it is
   * offered exactly where that lands the source higher than it sits now —
   * and stops at the edge of `known`, past which the honest act is a fresh
   * reading through the status grid rather than restating a two-month-old
   * one.
   */
  it("offers re-observe exactly when restating the reading would raise confidence", () => {
    for (const confirmations of [0, 1, 3]) {
      for (const ageDays of AGES) {
        const state = sourcePromptState(
          observation({
            observedAt: daysAgo(ageDays),
            confirmationCount: confirmations,
          }),
          NOW,
        );
        const raises =
          RANK[deriveConfidence({ ageDays: 0, confirmations: 0 })] >
          RANK[deriveConfidence({ ageDays, confirmations })];
        const known = ageDays <= CONFIDENCE_WINDOWS_DAYS.known;

        expect(state === "reobserve").toBe(raises && known);
      }
    }
  });
});
