// L04-FRM-MARKPAID, bulk mark-paid, undo (D-10, D-11, D-12, D-25).
import { describe, expect, it } from "vitest";

import {
  PAYMENT_UNDO_MS,
  markPaidDefaults,
  paymentRecordedMessage,
  planBulkPayments,
  receiptLabel,
  validateAmountEdit,
  validatePayment,
} from "@/app/(landlord)/rent/_lib/payments";
import { deriveRentState } from "@/app/(landlord)/rent/_lib/status";

const TODAY = "2026-10-26";
const due = (amountDue: number, paid: number[] = []) =>
  deriveRentState(
    { amountDue, dueOn: "2026-10-05" },
    paid.map((amount) => ({ amount, status: "recorded" as const })),
    TODAY,
  );

describe("L04-FRM-MARKPAID defaults (D-10: pre-fill the balance)", () => {
  it("pre-fills the full rent when nothing is paid, and today's date", () => {
    expect(markPaidDefaults(due(12_000), TODAY)).toEqual({ amount: 12_000, receivedOn: TODAY, reference: "" });
  });

  it("pre-fills only the balance after a part payment", () => {
    expect(markPaidDefaults(due(12_000, [8_000]), TODAY).amount).toBe(4_000);
  });
});

describe("validatePayment", () => {
  const ok = { amount: 4_000, receivedOn: TODAY, balance: 4_000, today: TODAY };

  it("accepts the balance, or less (a part payment)", () => {
    expect(validatePayment(ok)).toBeNull();
    expect(validatePayment({ ...ok, amount: 1 })).toBeNull();
  });

  it("refuses more than the balance: recording twice is impossible (D-10)", () => {
    expect(validatePayment({ ...ok, amount: 4_001 })).toBe("That is more than the ₹4,000 still due.");
  });

  it("refuses a missing or zero amount, and fractions (D-19)", () => {
    expect(validatePayment({ ...ok, amount: null })).toBe("Enter the amount received.");
    expect(validatePayment({ ...ok, amount: 0 })).toBe("Enter the amount received.");
    expect(validatePayment({ ...ok, amount: 10.5 })).toBe("Enter the amount in whole rupees.");
  });

  it("refuses anything when nothing is due", () => {
    expect(validatePayment({ ...ok, balance: 0 })).toBe("This month is already paid.");
  });

  it("needs a date that is not in the future", () => {
    expect(validatePayment({ ...ok, receivedOn: "" })).toBe("Enter the date received.");
    expect(validatePayment({ ...ok, receivedOn: "2026-10-27" })).toBe("The date received cannot be in the future.");
  });
});

describe("bulk mark-paid", () => {
  it("records each selected row's full balance and skips rows already paid", () => {
    const plan = planBulkPayments([
      { id: "a", state: due(18_000) },
      { id: "b", state: due(12_000, [8_000]) },
      { id: "c", state: due(10_000, [10_000]) },
    ]);
    expect(plan.payments).toEqual([
      { rentEntryId: "a", amount: 18_000 },
      { rentEntryId: "b", amount: 4_000 },
    ]);
    expect(plan.alreadyPaid).toEqual(["c"]);
    expect(plan.total).toBe(22_000);
  });
});

describe("E1-01 toast wording and the undo window (D-11)", () => {
  it("names the one receipt for a single payment", () => {
    expect(paymentRecordedMessage(["RR-0847"])).toBe("Payment recorded. Receipt RR-0847 created.");
  });

  it("names the range for a bulk payment with consecutive numbers", () => {
    expect(paymentRecordedMessage(["RR-0849", "RR-0848", "RR-0850"])).toBe(
      "3 payments recorded. Receipts RR-0848 to RR-0850 created.",
    );
  });

  it("counts rather than implying a range when the numbers are not consecutive", () => {
    expect(paymentRecordedMessage(["RR-0848", "RR-0852"])).toBe("2 payments recorded. 2 receipts created.");
  });

  it("keeps the toast up for the whole 10-second undo, not A2's 4 seconds", () => {
    expect(PAYMENT_UNDO_MS).toBe(10_000);
  });
});

describe("D-11 a voided receipt keeps its number", () => {
  it('shows the number with "— voided" rather than releasing it', () => {
    expect(receiptLabel({ receiptNumber: "RR-0847", status: "voided" })).toBe("RR-0847 — voided");
    expect(receiptLabel({ receiptNumber: "RR-0847", status: "recorded" })).toBe("RR-0847");
  });
});

describe("D-25 L05-BTN-EDIT", () => {
  it("allows an edit before any payment", () => {
    expect(validateAmountEdit({ state: due(10_000), next: 6_333 })).toBeNull();
  });

  it("allows an edit after a part payment, down to the amount already received", () => {
    expect(validateAmountEdit({ state: due(12_000, [8_000]), next: 8_000 })).toBeNull();
    expect(validateAmountEdit({ state: due(12_000, [8_000]), next: 7_999 })).toBe(
      "The amount due cannot be less than the ₹8,000 already received.",
    );
  });

  it("refuses an edit on a Paid row", () => {
    expect(validateAmountEdit({ state: due(12_000, [12_000]), next: 13_000 })).toBe(
      "A paid month cannot be edited. Void its payment first.",
    );
  });

  it("refuses an empty or unchanged amount", () => {
    expect(validateAmountEdit({ state: due(12_000), next: null })).toBe("Enter the new amount.");
    expect(validateAmountEdit({ state: due(12_000), next: 12_000 })).toBe("That is already the amount due.");
  });
});
