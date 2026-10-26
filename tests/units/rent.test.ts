// Rent rules as the units lane reads them: agreement in force (D-08), derived status (D-10), the
// tenant form's first rent row (D-24, D-39) and the L-11 paid-on-time percentage.
import { describe, expect, it } from "vitest";

import {
  agreementInForce,
  firstRentRow,
  onTimeRate,
  orderTerms,
  proRataAmount,
  rentChip,
  rentState,
} from "../../src/app/(landlord)/units/_lib/rent";

const terms = [
  { id: "a1", startsOn: "2024-04-01", endsOn: "2025-03-31", rent: 16000, rentDueDay: 5 },
  { id: "a2", startsOn: "2025-04-01", endsOn: "2026-03-31", rent: 17000, rentDueDay: 5 },
  { id: "a3", startsOn: "2026-04-01", endsOn: "2027-03-31", rent: 18000, rentDueDay: 5 },
];

describe("agreements (D-08)", () => {
  it("finds the term in force, and keeps the last one past its end", () => {
    expect(agreementInForce(terms, "2025-06-01")?.id).toBe("a2");
    expect(agreementInForce(terms, "2028-01-01")?.id).toBe("a3");
    expect(agreementInForce(terms, "2024-01-01")).toBeNull();
  });
  it("lists earlier terms beneath the current one, newest first, so renewals keep history", () => {
    const { current, earlier, upcoming } = orderTerms(terms, "2026-10-26");
    expect(current?.id).toBe("a3");
    expect(earlier.map((t) => t.id)).toEqual(["a2", "a1"]);
    expect(upcoming).toEqual([]);
  });
  it("keeps a renewal recorded ahead of time apart from the current term", () => {
    const { current, earlier, upcoming } = orderTerms(terms, "2025-12-01");
    expect(current?.id).toBe("a2");
    expect(earlier.map((t) => t.id)).toEqual(["a1"]);
    expect(upcoming.map((t) => t.id)).toEqual(["a3"]);
  });
});

describe("derived rent state (D-10, D-11)", () => {
  it("is Paid once recorded payments cover the amount; voided ones never count", () => {
    const state = rentState(
      {
        amountDue: 18000,
        dueOn: "2026-10-05",
        payments: [
          { amount: 18000, status: "voided", receivedOn: "2026-10-04" },
          { amount: 18000, status: "recorded", receivedOn: "2026-10-06" },
        ],
      },
      "2026-10-26",
    );
    expect(state.status).toBe("paid");
    expect(rentChip(state)).toEqual({ tone: "success", label: "Paid", sub: null });
  });
  it("reads as the rent board does when part paid and late", () => {
    const state = rentState(
      { amountDue: 18000, dueOn: "2026-10-05", payments: [{ amount: 14000, status: "recorded", receivedOn: "2026-10-05" }] },
      "2026-10-26",
    );
    expect(rentChip(state)).toEqual({ tone: "danger", label: "21 days late", sub: "Part paid — ₹4,000 pending" });
  });
});

describe("L11-SEC-PAYMENTS: on time = paid in full on or before the due date", () => {
  const today = "2026-10-26";
  const entry = (dueOn: string, ...payments: [number, string][]) => ({
    amountDue: 10000,
    dueOn,
    payments: payments.map(([amount, receivedOn]) => ({ amount, receivedOn, status: "recorded" as const })),
  });

  it("counts a payment on the due date itself as on time", () => {
    expect(onTimeRate([entry("2026-09-05", [10000, "2026-09-05"])], today)).toEqual({ onTime: 1, counted: 1, percent: 100 });
  });
  it("counts a payment a day after the due date as late", () => {
    expect(onTimeRate([entry("2026-09-05", [10000, "2026-09-06"])], today).onTime).toBe(0);
  });
  it("is late when only part arrived by the due date", () => {
    expect(onTimeRate([entry("2026-09-05", [6000, "2026-09-01"], [4000, "2026-09-10"])], today).onTime).toBe(0);
  });
  it("counts an unpaid month once its due date has passed", () => {
    expect(onTimeRate([entry("2026-10-05")], today)).toEqual({ onTime: 0, counted: 1, percent: 0 });
  });
  it("leaves out a month still inside its due date, unless already paid", () => {
    expect(onTimeRate([entry("2026-10-26")], today)).toEqual({ onTime: 0, counted: 0, percent: null });
    expect(onTimeRate([entry("2026-11-05", [10000, "2026-10-20"])], today)).toEqual({ onTime: 1, counted: 1, percent: 100 });
  });
  it("ignores voided payments", () => {
    const voided = { amountDue: 10000, dueOn: "2026-09-05", payments: [{ amount: 10000, receivedOn: "2026-09-01", status: "voided" as const }] };
    expect(onTimeRate([voided], today).onTime).toBe(0);
  });
  it("rounds to a whole percentage", () => {
    const entries = [
      entry("2026-07-05", [10000, "2026-07-05"]),
      entry("2026-08-05", [10000, "2026-08-04"]),
      entry("2026-09-05", [10000, "2026-09-09"]),
    ];
    expect(onTimeRate(entries, today)).toEqual({ onTime: 2, counted: 3, percent: 67 });
  });
});

describe("the tenant form's first rent row (D-24, D-39)", () => {
  it("is a full row due on the agreement's due day when moving in on the 1st", () => {
    expect(firstRentRow("2026-11-01", { rent: 18000, rentDueDay: 5 })).toEqual({
      month: "2026-11-01",
      amount_due: 18000,
      due_on: "2026-11-05",
      is_pro_rata: false,
    });
  });
  it("clamps a due day of 31 to the month's last day (D-09)", () => {
    expect(firstRentRow("2027-02-01", { rent: 18000, rentDueDay: 31 }).due_on).toBe("2027-02-28");
  });
  it("is pro-rata and due on the move-in date for any later day", () => {
    // 18000 × (30 − 16 + 1) ÷ 30 = 9000
    expect(firstRentRow("2026-11-16", { rent: 18000, rentDueDay: 5 })).toEqual({
      month: "2026-11-01",
      amount_due: 9000,
      due_on: "2026-11-16",
      is_pro_rata: true,
    });
  });
  it("rounds pro-rata to the whole rupee, half up (D-19)", () => {
    // 17500 × 21 ÷ 31 = 11854.83…
    expect(proRataAmount(17500, 11, 31)).toBe(11855);
    // ₹1 × 1 day ÷ 2 days = 0.5 → 1
    expect(proRataAmount(1, 2, 2)).toBe(1);
  });
});
