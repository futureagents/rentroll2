// L-08…L-11 behavioural rules: unit and tenancy status (D-05, D-13), the client filter, lifetime
// figures and the repeated-category note (L-09, decisions §9), the agreement countdown (L-11).
import { describe, expect, it } from "vitest";

import { agreementCountdown } from "../../src/app/(landlord)/units/_lib/agreement";
import { inLastTwelveMonths, kolkataDateOf, kolkataToday, oneYearBefore } from "../../src/app/(landlord)/units/_lib/dates";
import { lifetimeFigures, repeatedCategoryNotes } from "../../src/app/(landlord)/units/_lib/history";
import {
  parseStanding,
  STANDING_CHIP,
  STANDING_OPTIONS,
  tenancyStanding,
  unitOccupancy,
} from "../../src/app/(landlord)/units/_lib/occupancy";
import { matchesText } from "../../src/app/(landlord)/units/_lib/text-filter";

describe("unit status — L08-CHP-STATUS and the L-09 header chip (D-05, D-13)", () => {
  it("is Vacant without an active tenancy", () => {
    expect(unitOccupancy(null)).toBe("vacant");
    expect(unitOccupancy({ status: "ended", noticeVacateOn: null })).toBe("vacant");
    expect(unitOccupancy({ status: "settled", noticeVacateOn: "2026-11-30" })).toBe("vacant");
  });
  it("is Occupied with an active tenancy, Notice period once a vacate date is recorded", () => {
    expect(unitOccupancy({ status: "active", noticeVacateOn: null })).toBe("occupied");
    expect(unitOccupancy({ status: "active", noticeVacateOn: "2026-11-30" })).toBe("notice");
  });
});

describe("tenancy status — L-10 Status column and filter", () => {
  it("is exactly one of Current, On notice, Past", () => {
    expect(tenancyStanding({ status: "active", noticeVacateOn: null })).toBe("current");
    expect(tenancyStanding({ status: "active", noticeVacateOn: "2026-11-30" })).toBe("on_notice");
    expect(tenancyStanding({ status: "ended", noticeVacateOn: null })).toBe("past");
    expect(tenancyStanding({ status: "settled", noticeVacateOn: "2026-10-01" })).toBe("past");
  });
  it("uses the same words in the column as on the filter segments", () => {
    for (const option of STANDING_OPTIONS) expect(STANDING_CHIP[option.value].label).toBe(option.label);
  });
  it("defaults the filter to Current", () => {
    expect(parseStanding(undefined)).toBe("current");
    expect(parseStanding("nonsense")).toBe("current");
    expect(parseStanding(["past"])).toBe("past");
    expect(parseStanding("on_notice")).toBe("on_notice");
  });
});

describe("filter box (L-08, L-10)", () => {
  const row = ["4C", "Kulkarni Apartments", "2BHK", "Rohit Sharma", "+91 98765 43210", "Occupied"];
  it("matches every word, in any field, ignoring case", () => {
    expect(matchesText("kulkarni 4c", row)).toBe(true);
    expect(matchesText("rohit", row)).toBe(true);
    expect(matchesText("shanti 4c", row)).toBe(false);
  });
  it("matches phone digits however they are typed", () => {
    expect(matchesText("98765", row)).toBe(true);
    expect(matchesText("9876543210", row)).toBe(true);
    expect(matchesText("98765 43210", row)).toBe(true);
  });
  it("matches the status word, so L-03 can route to vacant units", () => {
    expect(matchesText("vacant", ["G1", "Shanti Niwas", null, null, "Vacant"])).toBe(true);
    expect(matchesText("vacant", row)).toBe(false);
  });
  it("shows everything for an empty filter", () => {
    expect(matchesText("   ", row)).toBe(true);
  });
});

describe("Kolkata dates", () => {
  it("reads today and timestamps in Asia/Kolkata", () => {
    expect(kolkataToday(new Date("2026-10-31T18:29:00Z"))).toBe("2026-10-31");
    expect(kolkataToday(new Date("2026-10-31T18:30:00Z"))).toBe("2026-11-01");
    expect(kolkataDateOf("2026-03-31T20:00:00+00:00")).toBe("2026-04-01");
  });
  it("rolls the 12-month window from the same date last year, exclusive", () => {
    expect(oneYearBefore("2028-02-29")).toBe("2027-02-28");
    expect(inLastTwelveMonths("2025-10-26", "2026-10-26")).toBe(false);
    expect(inLastTwelveMonths("2025-10-27", "2026-10-26")).toBe(true);
    expect(inLastTwelveMonths("2026-10-26", "2026-10-26")).toBe(true);
    expect(inLastTwelveMonths("2026-10-27", "2026-10-26")).toBe(false);
  });
});

describe("L-09 lifetime figures — the unit's whole history, every tenancy", () => {
  const today = "2026-10-26";
  const payments = [
    { amount: 18000, status: "recorded" as const, receivedOn: "2023-05-03" }, // an earlier tenant
    { amount: 18000, status: "recorded" as const, receivedOn: "2026-01-04" },
    { amount: 18000, status: "voided" as const, receivedOn: "2026-02-04" },
    { amount: 9000, status: "recorded" as const, receivedOn: "2026-10-05" },
  ];
  const requests = [
    { status: "done" as const, cost: 4000, doneAt: "2024-06-10T10:00:00Z" },
    { status: "done" as const, cost: 2500, doneAt: "2026-08-01T10:00:00Z" },
    { status: "done" as const, cost: null, doneAt: "2026-09-01T10:00:00Z" }, // "no cost" (D-22)
    { status: "in_progress" as const, cost: 9000, doneAt: null }, // not Done: not spend yet
  ];
  it("sums recorded payments and Done costs across all time", () => {
    expect(lifetimeFigures(payments, requests, today).lifetime).toEqual({ collected: 45000, spend: 6500, net: 38500 });
  });
  it("gives the last 12 months beneath", () => {
    expect(lifetimeFigures(payments, requests, today).lastTwelveMonths).toEqual({
      collected: 27000,
      spend: 2500,
      net: 24500,
    });
  });
  it("lets net go negative", () => {
    expect(lifetimeFigures([], [{ status: "done", cost: 3000, doneAt: "2026-01-01T00:00:00Z" }], today).lifetime.net).toBe(-3000);
  });
});

describe("L09-TAB-MAINT repeated-category note (decisions §9: 3 or more in 12 months)", () => {
  const today = "2026-10-26";
  const at = (createdAt: string, category: "plumbing" | "electrical" | "pest" = "plumbing") => ({ category, createdAt });
  it("speaks once a category reaches three in the rolling 12 months", () => {
    const requests = [at("2026-01-02T00:00:00Z"), at("2026-03-02T00:00:00Z"), at("2026-09-02T00:00:00Z"), at("2026-10-20T00:00:00Z")];
    expect(repeatedCategoryNotes(requests, today)).toEqual(["Plumbing reported 4 times in 12 months."]);
  });
  it("stays quiet at two, and ignores reports older than 12 months", () => {
    const requests = [at("2025-10-01T00:00:00Z"), at("2026-03-02T00:00:00Z"), at("2026-09-02T00:00:00Z")];
    expect(repeatedCategoryNotes(requests, today)).toEqual([]);
  });
  it("orders several notes by frequency", () => {
    const requests = [
      ...["01", "02", "03"].map((m) => at(`2026-${m}-05T00:00:00Z`, "electrical")),
      ...["04", "05", "06", "07"].map((m) => at(`2026-${m}-05T00:00:00Z`, "pest")),
    ];
    expect(repeatedCategoryNotes(requests, today)).toEqual([
      "Pest reported 4 times in 12 months.",
      "Electrical reported 3 times in 12 months.",
    ]);
  });
});

describe("L11-SEC-AGREEMENT countdown (within 90 days)", () => {
  const today = "2026-10-26";
  it("is absent beyond 90 days", () => {
    expect(agreementCountdown("2027-01-25", today)).toBeNull(); // 91 days
  });
  it("bands like L-12, with 30 and 60 in the lower band", () => {
    expect(agreementCountdown("2027-01-24", today)).toEqual({ tone: "neutral", label: "Ends in 90 days" });
    expect(agreementCountdown("2026-12-25", today)).toEqual({ tone: "warning", label: "Ends in 60 days" });
    expect(agreementCountdown("2026-11-25", today)).toEqual({ tone: "danger", label: "Ends in 30 days" });
    expect(agreementCountdown("2026-10-26", today)).toEqual({ tone: "danger", label: "Ends today" });
  });
  it("says how long ago an agreement expired", () => {
    expect(agreementCountdown("2026-10-12", today)).toEqual({ tone: "danger", label: "Expired 14 days ago" });
  });
});
