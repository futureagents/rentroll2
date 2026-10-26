// S-01 tone pre-selection: D-38 ladder, capped by confirmed contacts (D-41).
import { describe, expect, it } from "vitest";

import {
  levelByDays,
  parseLadderDays,
  preselectLevel,
  toneForLevel,
  type LadderDays,
} from "@/components/composer/ladder";

const DEFAULT: LadderDays = [3, 10, 20];

describe("D-38 levelByDays", () => {
  it("is Gentle before the due date, on days 1–2 and from day₁", () => {
    expect(levelByDays(-4, DEFAULT)).toBe(1);
    expect(levelByDays(0, DEFAULT)).toBe(1);
    expect(levelByDays(2, DEFAULT)).toBe(1);
    expect(levelByDays(3, DEFAULT)).toBe(1);
    expect(levelByDays(9, DEFAULT)).toBe(1);
  });

  it("is Direct from day₂ and Formal from day₃", () => {
    expect(levelByDays(10, DEFAULT)).toBe(2);
    expect(levelByDays(18, DEFAULT)).toBe(2); // the S-01 example is Level 2, not 3 (D-38)
    expect(levelByDays(20, DEFAULT)).toBe(3);
    expect(levelByDays(45, DEFAULT)).toBe(3);
  });

  it("reads the landlord's own ladder days, not 3/10/20", () => {
    const custom: LadderDays = [5, 7, 9];
    expect(levelByDays(6, custom)).toBe(1);
    expect(levelByDays(7, custom)).toBe(2);
    expect(levelByDays(9, custom)).toBe(3);
    expect(levelByDays(10, [2, 15, 30])).toBe(1);
  });
});

describe("D-41 preselectLevel = min(level_by_days, contacts + 1)", () => {
  it("offers Gentle on day 20 when nothing was ever confirmed sent", () => {
    // Opening the composer three times without sending writes nothing, so contacts stays 0.
    expect(preselectLevel({ daysOverdue: 20, ladderDays: DEFAULT, contacts: 0 })).toBe(1);
    expect(toneForLevel(preselectLevel({ daysOverdue: 60, ladderDays: DEFAULT, contacts: 0 }))).toBe("gentle");
  });

  it("steps up one level per confirmed contact, never past the days level", () => {
    expect(preselectLevel({ daysOverdue: 20, ladderDays: DEFAULT, contacts: 1 })).toBe(2);
    expect(preselectLevel({ daysOverdue: 20, ladderDays: DEFAULT, contacts: 2 })).toBe(3);
    expect(preselectLevel({ daysOverdue: 12, ladderDays: DEFAULT, contacts: 5 })).toBe(2);
    expect(preselectLevel({ daysOverdue: 4, ladderDays: DEFAULT, contacts: 5 })).toBe(1);
  });

  it("counts logged calls as contacts (the caller adds reminders and calls)", () => {
    const reminders = 1;
    const calls = 1;
    expect(preselectLevel({ daysOverdue: 25, ladderDays: DEFAULT, contacts: reminders + calls })).toBe(3);
  });

  it("uses the landlord's ladder for the days cap", () => {
    expect(preselectLevel({ daysOverdue: 9, ladderDays: [5, 7, 9], contacts: 2 })).toBe(3);
    expect(preselectLevel({ daysOverdue: 9, ladderDays: DEFAULT, contacts: 2 })).toBe(1);
  });
});

describe("parseLadderDays (D-20 shape)", () => {
  it("accepts three ascending integers in 1–60", () => {
    expect(parseLadderDays([3, 10, 20])).toEqual([3, 10, 20]);
    expect(parseLadderDays([1, 2, 60])).toEqual([1, 2, 60]);
  });

  it("rejects anything else", () => {
    for (const bad of [null, [3, 10], [10, 3, 20], [3, 3, 20], [0, 10, 20], [3, 10, 61], [3, 10.5, 20], "3,10,20"]) {
      expect(parseLadderDays(bad)).toBeNull();
    }
  });
});
