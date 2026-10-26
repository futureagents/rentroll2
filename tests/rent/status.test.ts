// D-10: rent status is derived from the sum of recorded payments, never stored.
import { describe, expect, it } from "vitest";

import {
  deriveRentState,
  matchesFilter,
  parseRentFilter,
  partPaidLine,
  rentChip,
  rowActions,
  summarise,
  type PaymentForStatus,
} from "@/app/(landlord)/rent/_lib/status";

const entry = { amountDue: 12_000, dueOn: "2026-10-05" };
const paid = (amount: number, status: PaymentForStatus["status"] = "recorded"): PaymentForStatus => ({ amount, status });

describe("D-10 derived status", () => {
  it("is Due with nothing paid on or before the due date", () => {
    const state = deriveRentState(entry, [], "2026-10-05");
    expect(state).toMatchObject({ status: "due", due: 12_000, paid: 0, balance: 12_000, daysLate: 0, partPaid: false });
  });

  it("is Overdue the day after the due date, counted from due_on not the 1st (D-09)", () => {
    const state = deriveRentState(entry, [], "2026-10-23");
    expect(state.status).toBe("overdue");
    expect(state.daysLate).toBe(18);
  });

  it("is Paid once recorded payments reach the amount due", () => {
    const state = deriveRentState(entry, [paid(8_000), paid(4_000)], "2026-10-23");
    expect(state).toMatchObject({ status: "paid", paid: 12_000, balance: 0, daysLate: 0 });
  });

  it("ignores voided payments (D-11)", () => {
    const state = deriveRentState(entry, [paid(12_000, "voided")], "2026-10-04");
    expect(state).toMatchObject({ status: "due", paid: 0, balance: 12_000 });
  });

  it("marks a part payment and keeps the balance outstanding", () => {
    const state = deriveRentState(entry, [paid(8_000)], "2026-10-04");
    expect(state).toMatchObject({ status: "due", paid: 8_000, balance: 4_000, partPaid: true });
  });

  it("treats a zero amount due as Paid", () => {
    expect(deriveRentState({ amountDue: 0, dueOn: "2026-10-05" }, [], "2026-10-20").status).toBe("paid");
  });
});

describe("L04-CHP-STATUS wording and tone (A1: never colour alone)", () => {
  it("Paid is success", () => {
    expect(rentChip(deriveRentState(entry, [paid(12_000)], "2026-10-20"))).toEqual({ tone: "success", label: "Paid" });
  });

  it("Due is neutral", () => {
    expect(rentChip(deriveRentState(entry, [], "2026-10-01"))).toEqual({ tone: "neutral", label: "Due" });
  });

  it("1–9 days late is warning, singular at one day", () => {
    expect(rentChip(deriveRentState(entry, [], "2026-10-06"))).toEqual({ tone: "warning", label: "1 day late" });
    expect(rentChip(deriveRentState(entry, [], "2026-10-14"))).toEqual({ tone: "warning", label: "9 days late" });
  });

  it("10+ days late is danger", () => {
    expect(rentChip(deriveRentState(entry, [], "2026-10-15"))).toEqual({ tone: "danger", label: "10 days late" });
    expect(rentChip(deriveRentState(entry, [], "2026-10-23"))).toEqual({ tone: "danger", label: "18 days late" });
  });
});

describe("part payment (L-04 rule, D-10)", () => {
  it('reads "Part paid — ₹4,000 pending" with Indian grouping', () => {
    const state = deriveRentState(entry, [paid(8_000)], "2026-10-04");
    expect(partPaidLine(state)).toBe("Part paid — ₹4,000 pending");
  });

  it("has no sub-line when nothing or everything is paid", () => {
    expect(partPaidLine(deriveRentState(entry, [], "2026-10-04"))).toBeNull();
    expect(partPaidLine(deriveRentState(entry, [paid(12_000)], "2026-10-04"))).toBeNull();
  });

  it("stays in Pending before the due date", () => {
    const state = deriveRentState(entry, [paid(8_000)], "2026-10-04");
    expect(matchesFilter(state, "pending")).toBe(true);
    expect(matchesFilter(state, "paid")).toBe(false);
  });

  it("moves to Overdue, not Pending, after the due date: the filters are disjoint (D-10)", () => {
    const state = deriveRentState(entry, [paid(8_000)], "2026-10-10");
    expect(matchesFilter(state, "overdue")).toBe(true);
    expect(matchesFilter(state, "pending")).toBe(false);
    expect(partPaidLine(state)).toBe("Part paid — ₹4,000 pending");
  });

  it("leaves Mark paid available for the balance; only a full payment removes it", () => {
    const part = deriveRentState(entry, [paid(8_000)], "2026-10-04");
    expect(rowActions(part)).toEqual({ remind: true, markPaid: true, receipt: false });
    const full = deriveRentState(entry, [paid(8_000), paid(4_000)], "2026-10-04");
    expect(rowActions(full)).toEqual({ remind: false, markPaid: false, receipt: true });
  });
});

describe("L04-SEG-FILTER", () => {
  it("All matches everything", () => {
    for (const today of ["2026-10-01", "2026-10-20"]) {
      expect(matchesFilter(deriveRentState(entry, [], today), "all")).toBe(true);
    }
  });

  it("parses the URL value, defaulting to All", () => {
    expect(parseRentFilter("overdue")).toBe("overdue");
    expect(parseRentFilter("PAID")).toBe("all");
    expect(parseRentFilter(undefined)).toBe("all");
  });
});

describe("L04-STRIP-SUMMARY", () => {
  it("sums expected, collected and outstanding over the rows given (the filtered view)", () => {
    const states = [
      deriveRentState({ amountDue: 18_000, dueOn: "2026-10-05" }, [paid(18_000)], "2026-10-20"),
      deriveRentState({ amountDue: 12_000, dueOn: "2026-10-05" }, [paid(8_000)], "2026-10-20"),
      deriveRentState({ amountDue: 6_333, dueOn: "2026-10-12" }, [], "2026-10-20"),
    ];
    expect(summarise(states)).toEqual({ expected: 36_333, collected: 26_000, outstanding: 10_333 });
    expect(summarise([])).toEqual({ expected: 0, collected: 0, outstanding: 0 });
  });
});
