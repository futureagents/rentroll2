// D-09, D-24: rent calendar maths. Rent rows are created on the 1st in Asia/Kolkata, and due
// dates clamp to the last day of a short month.
import { describe, expect, it } from "vitest";

import {
  addMonths,
  daysBetween,
  daysInMonth,
  dueOnFor,
  firstOfMonth,
  isFirstOfMonthInKolkata,
  isMonthKey,
  kolkataToday,
  lastOfMonth,
  monthOf,
} from "@/app/(landlord)/rent/_lib/calendar";

describe("D-24 Asia/Kolkata calendar", () => {
  it("reads today in Kolkata, not UTC: 18:30 UTC on 31 Oct is 1 Nov in India", () => {
    expect(kolkataToday(new Date("2026-10-31T18:29:59Z"))).toBe("2026-10-31");
    expect(kolkataToday(new Date("2026-10-31T18:30:00Z"))).toBe("2026-11-01");
  });

  it("is the 1st in Kolkata while still the 31st in UTC", () => {
    const now = new Date("2026-10-31T20:00:00Z");
    expect(now.getUTCDate()).toBe(31);
    expect(isFirstOfMonthInKolkata(now)).toBe(true);
  });

  it("is no longer the 1st in Kolkata at 19:00 UTC on the 1st (00:30 on the 2nd IST)", () => {
    expect(isFirstOfMonthInKolkata(new Date("2026-11-01T18:30:00Z"))).toBe(false);
    expect(isFirstOfMonthInKolkata(new Date("2026-11-01T18:29:00Z"))).toBe(true);
  });

  it("rolls the year at Kolkata midnight on 1 January", () => {
    expect(kolkataToday(new Date("2026-12-31T18:30:00Z"))).toBe("2027-01-01");
  });
});

describe("months", () => {
  it("validates YYYY-MM keys", () => {
    expect(isMonthKey("2026-02")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-2")).toBe(false);
    expect(isMonthKey("garbage")).toBe(false);
  });

  it("derives first and last days", () => {
    expect(monthOf("2026-02-17")).toBe("2026-02");
    expect(firstOfMonth("2026-02")).toBe("2026-02-01");
    expect(lastOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastOfMonth("2028-02")).toBe("2028-02-29");
  });

  it("counts days in month including leap February", () => {
    expect(daysInMonth("2026-01")).toBe(31);
    expect(daysInMonth("2026-04")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });

  it("steps months across year ends", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("counts calendar days between two dates", () => {
    expect(daysBetween("2026-10-05", "2026-10-23")).toBe(18);
    expect(daysBetween("2026-10-05", "2026-10-05")).toBe(0);
    expect(daysBetween("2026-10-05", "2026-10-01")).toBe(-4);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });
});

describe("D-09 due day clamps to the month's last day", () => {
  it("uses the agreement's due day when the month has it", () => {
    expect(dueOnFor("2026-10", 5)).toBe("2026-10-05");
    expect(dueOnFor("2026-10", 31)).toBe("2026-10-31");
  });

  it("clamps 29, 30 and 31 to 28 February in a common year", () => {
    expect(dueOnFor("2026-02", 29)).toBe("2026-02-28");
    expect(dueOnFor("2026-02", 30)).toBe("2026-02-28");
    expect(dueOnFor("2026-02", 31)).toBe("2026-02-28");
  });

  it("keeps 29 February in a leap year and clamps 30 and 31 to it", () => {
    expect(dueOnFor("2028-02", 29)).toBe("2028-02-29");
    expect(dueOnFor("2028-02", 30)).toBe("2028-02-29");
    expect(dueOnFor("2028-02", 31)).toBe("2028-02-29");
  });

  it("clamps 31 to the 30th in a 30-day month", () => {
    expect(dueOnFor("2026-04", 31)).toBe("2026-04-30");
    expect(dueOnFor("2026-04", 30)).toBe("2026-04-30");
  });
});
