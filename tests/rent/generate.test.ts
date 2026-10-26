// D-08, D-09, D-24: which rent rows the 1st-of-month job plans, and with what amount and due date.
import { describe, expect, it } from "vitest";

import {
  agreementInForce,
  planRentRows,
  proRataAmount,
  type AgreementTerm,
  type TenancyForRent,
} from "@/app/(landlord)/rent/_lib/generate";

const term = (over: Partial<AgreementTerm> = {}): AgreementTerm => ({
  id: "agr-1",
  startsOn: "2026-01-01",
  endsOn: "2026-11-30",
  rent: 18_000,
  rentDueDay: 5,
  ...over,
});

const tenancy = (over: Partial<TenancyForRent> = {}): TenancyForRent => ({
  id: "ten-1",
  unitId: "unit-1",
  movedInOn: "2026-01-01",
  endedOn: null,
  agreements: [term()],
  ...over,
});

describe("D-24 one full row per tenancy occupying the unit on the 1st", () => {
  it("creates one row with the agreement's rent and due date", () => {
    const { rows, skipped } = planRentRows("2026-10", [tenancy()]);
    expect(skipped).toEqual([]);
    expect(rows).toEqual([
      {
        tenancy_id: "ten-1",
        unit_id: "unit-1",
        agreement_id: "agr-1",
        month: "2026-10-01",
        amount_due: 18_000,
        due_on: "2026-10-05",
        is_pro_rata: false,
      },
    ]);
  });

  it("clamps a due day of 31 to 28 February (D-09)", () => {
    const t = tenancy({ agreements: [term({ rentDueDay: 31, endsOn: "2026-12-31" })] });
    expect(planRentRows("2026-02", [t]).rows[0].due_on).toBe("2026-02-28");
  });

  it("clamps a due day of 30 to 29 February in a leap year (D-09)", () => {
    const t = tenancy({
      movedInOn: "2027-06-01",
      agreements: [term({ startsOn: "2027-06-01", endsOn: "2028-05-31", rentDueDay: 30 })],
    });
    expect(planRentRows("2028-02", [t]).rows[0].due_on).toBe("2028-02-29");
  });

  it("treats a move-in on the 1st itself as a full month, not pro-rata", () => {
    const t = tenancy({ movedInOn: "2026-10-01", agreements: [term({ startsOn: "2026-10-01" })] });
    const [row] = planRentRows("2026-10", [t]).rows;
    expect(row.is_pro_rata).toBe(false);
    expect(row.amount_due).toBe(18_000);
  });

  it("keeps the full row for a tenancy that ends mid-month (D-24)", () => {
    const t = tenancy({ endedOn: "2026-10-12" });
    const [row] = planRentRows("2026-10", [t]).rows;
    expect(row.amount_due).toBe(18_000);
    expect(row.is_pro_rata).toBe(false);
  });
});

describe("D-08 amount from the agreement in force on the 1st", () => {
  const original = term({ id: "agr-old", startsOn: "2025-11-01", endsOn: "2026-10-14", rent: 16_000, rentDueDay: 5 });
  const renewal = term({ id: "agr-new", startsOn: "2026-10-15", endsOn: "2027-09-14", rent: 17_000, rentDueDay: 10 });
  const renewed = tenancy({ movedInOn: "2025-11-01", agreements: [renewal, original] });

  it("uses the old term for a month whose 1st falls before the renewal starts", () => {
    const [row] = planRentRows("2026-10", [renewed]).rows;
    expect(row.agreement_id).toBe("agr-old");
    expect(row.amount_due).toBe(16_000);
    expect(row.due_on).toBe("2026-10-05");
  });

  it("applies the renewal from the first month whose 1st it covers, with its own due day", () => {
    const [row] = planRentRows("2026-11", [renewed]).rows;
    expect(row.agreement_id).toBe("agr-new");
    expect(row.amount_due).toBe(17_000);
    expect(row.due_on).toBe("2026-11-10");
  });

  it("applies a renewal that starts exactly on the 1st to that month", () => {
    const onFirst = term({ id: "agr-first", startsOn: "2026-10-01", endsOn: "2027-08-31", rent: 19_000 });
    const t = tenancy({
      agreements: [term({ startsOn: "2025-10-01", endsOn: "2026-09-30" }), onFirst],
    });
    expect(planRentRows("2026-10", [t]).rows[0].amount_due).toBe(19_000);
  });

  it("continues the last term's rent after it expires (L-12, D-08)", () => {
    const expired = term({ id: "agr-exp", startsOn: "2025-09-01", endsOn: "2026-07-31", rent: 17_000 });
    const t = tenancy({ movedInOn: "2025-09-01", agreements: [expired] });
    const [row] = planRentRows("2026-10", [t]).rows;
    expect(row.agreement_id).toBe("agr-exp");
    expect(row.amount_due).toBe(17_000);
  });

  it("finds the term containing the date regardless of input order", () => {
    const a = term({ id: "a", startsOn: "2025-01-01", endsOn: "2025-12-31" });
    const b = term({ id: "b", startsOn: "2026-01-01", endsOn: "2026-12-31" });
    expect(agreementInForce([b, a], "2025-06-01")?.id).toBe("a");
    expect(agreementInForce([a, b], "2026-06-01")?.id).toBe("b");
    expect(agreementInForce([a, b], "2027-03-01")?.id).toBe("b");
    expect(agreementInForce([a, b], "2024-12-31")).toBeNull();
  });

  it("skips, and reports, a tenancy with no agreement in force rather than guessing an amount", () => {
    const t = tenancy({ agreements: [term({ startsOn: "2026-12-01", endsOn: "2027-11-30" })] });
    const { rows, skipped } = planRentRows("2026-10", [t]);
    expect(rows).toEqual([]);
    expect(skipped).toEqual([{ tenancyId: "ten-1", reason: "no_agreement" }]);
  });
});

describe("D-24 mid-month move-in creates a flagged pro-rata row", () => {
  const g1 = tenancy({
    id: "ten-g1",
    unitId: "unit-g1",
    movedInOn: "2026-09-12",
    agreements: [term({ id: "agr-g1", startsOn: "2026-09-12", endsOn: "2027-08-11", rent: 10_000, rentDueDay: 1 })],
  });

  it("charges rent × days remaining ÷ days in month, rounded to the rupee, due on move-in", () => {
    // September has 30 days; the 12th to the 30th is 19 days: 10,000 × 19 ÷ 30 = 6,333.33 → 6,333.
    const [row] = planRentRows("2026-09", [g1]).rows;
    expect(row).toEqual({
      tenancy_id: "ten-g1",
      unit_id: "unit-g1",
      agreement_id: "agr-g1",
      month: "2026-09-01",
      amount_due: 6_333,
      due_on: "2026-09-12",
      is_pro_rata: true,
    });
  });

  it("returns to a full row from the next month", () => {
    const [row] = planRentRows("2026-10", [g1]).rows;
    expect(row.is_pro_rata).toBe(false);
    expect(row.amount_due).toBe(10_000);
    expect(row.due_on).toBe("2026-10-01");
  });

  it("rounds half up to the whole rupee (D-19)", () => {
    expect(proRataAmount(15_000, 17, 30)).toBe(7_000); // 15,000 × 14 ÷ 30 = 7,000
    expect(proRataAmount(10_000, 2, 31)).toBe(9_677); // 9,677.42
    expect(proRataAmount(1_001, 16, 31)).toBe(517); // 516.65
    expect(proRataAmount(3, 2, 4)).toBe(2); // 2.25
    expect(proRataAmount(10, 3, 4)).toBe(5); // 5.0
    expect(proRataAmount(2, 4, 4)).toBe(1); // 0.5 → 1
  });

  it("charges the full rent for a move-in on the 1st", () => {
    expect(proRataAmount(10_000, 1, 30)).toBe(10_000);
  });
});

describe("vacant units generate nothing (L-04, D-24)", () => {
  it("creates no row for a tenancy that ended before the 1st", () => {
    const t = tenancy({ endedOn: "2026-09-30" });
    expect(planRentRows("2026-10", [t])).toEqual({ rows: [], skipped: [] });
  });

  it("creates no row for a tenancy that moves in after the month", () => {
    const t = tenancy({ movedInOn: "2026-11-03", agreements: [term({ startsOn: "2026-11-03", endsOn: "2027-10-02" })] });
    expect(planRentRows("2026-10", [t])).toEqual({ rows: [], skipped: [] });
  });

  it("creates nothing when there are no tenancies at all", () => {
    expect(planRentRows("2026-10", [])).toEqual({ rows: [], skipped: [] });
  });

  it("creates one row per occupied unit and none for the vacant one", () => {
    const occupied = tenancy({ id: "a", unitId: "u-a" });
    const leftLastMonth = tenancy({ id: "b", unitId: "u-b", endedOn: "2026-09-15" });
    const { rows } = planRentRows("2026-10", [occupied, leftLastMonth]);
    expect(rows.map((r) => r.unit_id)).toEqual(["u-a"]);
  });
});
