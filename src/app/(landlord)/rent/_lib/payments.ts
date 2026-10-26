// L04-FRM-MARKPAID, bulk mark-paid, Undo and L05-BTN-EDIT rules (D-10, D-11, D-12, D-25).
// Client-safe: the form validates with these and the server action validates again.
import { formatRupees } from "@/lib/format";

import type { IsoDate } from "./calendar";
import type { RentState } from "./status";

/**
 * D-11: the payment toast stays for the whole 10-second Undo, the one exception to A2's 4-second
 * toast. The toast is the only Undo affordance, so it must not disappear while Undo still works.
 */
export const PAYMENT_UNDO_MS = 10_000;

/** D-10: the form pre-fills the balance, not the full rent, so a second instalment is one click. */
export function markPaidDefaults(state: RentState, today: IsoDate) {
  return { amount: state.balance, receivedOn: today, reference: "" };
}

export function validatePayment(input: {
  amount: number | null;
  receivedOn: string;
  balance: number;
  today: IsoDate;
}): string | null {
  if (input.balance <= 0) return "This month is already paid.";
  if (input.amount === null || input.amount <= 0) return "Enter the amount received.";
  if (!Number.isInteger(input.amount)) return "Enter the amount in whole rupees.";
  if (input.amount > input.balance) return `That is more than the ${formatRupees(input.balance)} still due.`;
  if (!input.receivedOn) return "Enter the date received.";
  if (input.receivedOn > input.today) return "The date received cannot be in the future.";
  return null;
}

/**
 * Bulk mark-paid: each selected row is recorded at its full balance, received today, with no
 * reference. Rows already Paid are left out. Part payments and references go through the
 * per-row form.
 */
export function planBulkPayments(rows: { id: string; state: RentState }[]) {
  const payments = rows
    .filter((r) => r.state.balance > 0)
    .map((r) => ({ rentEntryId: r.id, amount: r.state.balance }));
  return {
    payments,
    alreadyPaid: rows.filter((r) => r.state.balance <= 0).map((r) => r.id),
    total: payments.reduce((sum, p) => sum + p.amount, 0),
  };
}

const receiptOrdinal = (receipt: string) => Number(receipt.replace(/\D/g, ""));

/** E1-01 "Payment recorded. Receipt RR-0847 created.", and its plural for bulk mark-paid. */
export function paymentRecordedMessage(receipts: string[]): string {
  if (receipts.length === 1) return `Payment recorded. Receipt ${receipts[0]} created.`;
  const sorted = [...receipts].sort((a, b) => receiptOrdinal(a) - receiptOrdinal(b));
  const consecutive = sorted.every((r, i) => i === 0 || receiptOrdinal(r) === receiptOrdinal(sorted[i - 1]) + 1);
  const created = consecutive
    ? `Receipts ${sorted[0]} to ${sorted[sorted.length - 1]} created.`
    : `${receipts.length} receipts created.`;
  return `${receipts.length} payments recorded. ${created}`;
}

/** D-11: a voided receipt keeps its number and says so; numbers are never released or reused. */
export function receiptLabel(payment: { receiptNumber: string; status: "recorded" | "voided" }): string {
  return payment.status === "voided" ? `${payment.receiptNumber} — voided` : payment.receiptNumber;
}

/** D-25: edit while not Paid, including after a part payment, never below what was received. */
export function validateAmountEdit(input: { state: RentState; next: number | null }): string | null {
  const { state, next } = input;
  if (state.status === "paid") return "A paid month cannot be edited. Void its payment first.";
  if (next === null) return "Enter the new amount.";
  if (!Number.isInteger(next) || next < 0) return "Enter the amount in whole rupees.";
  if (next < state.paid) return `The amount due cannot be less than the ${formatRupees(state.paid)} already received.`;
  if (next === state.due) return "That is already the amount due.";
  return null;
}
