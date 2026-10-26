// S01-CHP-CONTEXT (D-38, D-41) and the S01-BNR-STALE warning (D-41, E1-12 †, E1-13 †).
import { describe, expect, it } from "vitest";

import { daysBetween, rentContextChips, staleBoardNote } from "@/components/composer/context-line";

describe("daysBetween", () => {
  it("counts calendar days across months and leap days", () => {
    expect(daysBetween("2026-10-05", "2026-10-23")).toBe(18);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-11-05", "2026-10-26")).toBe(-10);
  });
});

describe("S01-CHP-CONTEXT", () => {
  it("reads Rent · n days overdue · Level k of 3 · m sent", () => {
    expect(
      rentContextChips({ daysOverdue: 18, dueOn: "2026-10-05", level: 2, remindersSent: 1, callsLogged: 0 }),
    ).toEqual(["Rent", "18 days overdue", "Level 2 of 3", "1 sent"]);
  });

  it("adds logged calls and handles 1 day, due today and not yet due", () => {
    expect(
      rentContextChips({ daysOverdue: 1, dueOn: "2026-10-25", level: 1, remindersSent: 0, callsLogged: 2 }),
    ).toEqual(["Rent", "1 day overdue", "Level 1 of 3", "0 sent", "2 called"]);
    expect(rentContextChips({ daysOverdue: 0, dueOn: "2026-10-26", level: 1, remindersSent: 0, callsLogged: 0 })[1]).toBe(
      "Due today",
    );
    expect(rentContextChips({ daysOverdue: -4, dueOn: "2026-10-30", level: 1, remindersSent: 0, callsLogged: 0 })[1]).toBe(
      "Due 30 Oct 2026",
    );
  });
});

describe("S01-BNR-STALE", () => {
  it("warns when the board was last updated before the due date", () => {
    expect(staleBoardNote({ lastUpdateOn: "2026-10-17", dueOn: "2026-10-20", today: "2026-10-26" })).toBe(
      "You last updated this board 9 days ago — check before sending.",
    );
  });

  it("uses the singular for one day", () => {
    expect(staleBoardNote({ lastUpdateOn: "2026-10-25", dueOn: "2026-10-26", today: "2026-10-26" })).toBe(
      "You last updated this board 1 day ago — check before sending.",
    );
  });

  it("is silent once the board was updated on or after the due date", () => {
    expect(staleBoardNote({ lastUpdateOn: "2026-10-20", dueOn: "2026-10-20", today: "2026-10-26" })).toBeNull();
    expect(staleBoardNote({ lastUpdateOn: "2026-10-24", dueOn: "2026-10-20", today: "2026-10-26" })).toBeNull();
  });

  it("is silent before the due date", () => {
    expect(staleBoardNote({ lastUpdateOn: "2026-09-01", dueOn: "2026-10-30", today: "2026-10-26" })).toBeNull();
    expect(staleBoardNote({ lastUpdateOn: null, dueOn: "2026-10-30", today: "2026-10-26" })).toBeNull();
  });

  it("says so when nothing was ever recorded", () => {
    expect(staleBoardNote({ lastUpdateOn: null, dueOn: "2026-10-05", today: "2026-10-26" })).toBe(
      "You have not updated this board yet — check before sending.",
    );
  });
});
