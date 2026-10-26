// D-10: a rent entry's status is derived from the sum of its recorded payments, never stored.
//
// PROMOTE: rent status derivation — L-03 (Outstanding, Needs attention), L-09 Rent tab and S-01's
// context chip read the same rules; it belongs in a shared rent module.
import { formatRupees } from "@/lib/format";

import { daysBetween, type IsoDate } from "./calendar";

export type RentStatus = "paid" | "due" | "overdue";
export type RentFilter = "all" | "pending" | "overdue" | "paid";

export interface PaymentForStatus {
  amount: number;
  status: "recorded" | "voided";
}

export interface RentState {
  status: RentStatus;
  due: number;
  /** Sum of recorded payments; voided ones never count (D-11). */
  paid: number;
  balance: number;
  /** Days after `due_on` (D-09); 0 unless overdue. */
  daysLate: number;
  /** Something received, not yet all of it. */
  partPaid: boolean;
}

export function deriveRentState(
  entry: { amountDue: number; dueOn: IsoDate },
  payments: PaymentForStatus[],
  today: IsoDate,
): RentState {
  const paid = payments.filter((p) => p.status === "recorded").reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, entry.amountDue - paid);
  if (balance === 0) {
    return { status: "paid", due: entry.amountDue, paid, balance, daysLate: 0, partPaid: false };
  }
  const late = daysBetween(entry.dueOn, today);
  return {
    status: late > 0 ? "overdue" : "due",
    due: entry.amountDue,
    paid,
    balance,
    daysLate: Math.max(0, late),
    partPaid: paid > 0,
  };
}

/** L04-CHP-STATUS: Paid (success) · Due (neutral) · n days late (warning at 1–9, danger at 10+). */
export function rentChip(state: RentState): { tone: "success" | "neutral" | "warning" | "danger"; label: string } {
  if (state.status === "paid") return { tone: "success", label: "Paid" };
  if (state.status === "due") return { tone: "neutral", label: "Due" };
  const label = state.daysLate === 1 ? "1 day late" : `${state.daysLate} days late`;
  return { tone: state.daysLate >= 10 ? "danger" : "warning", label };
}

/** L-04 part payment: "Part paid — ₹4,000 pending" beneath the chip (D-10). */
export function partPaidLine(state: RentState): string | null {
  return state.partPaid ? `Part paid — ${formatRupees(state.balance)} pending` : null;
}

/**
 * D-10: Pending = not Paid and not past the due date; Overdue = not Paid and past it. The two are
 * disjoint, so a part-paid row sits in whichever its due date puts it.
 */
export function matchesFilter(state: RentState, filter: RentFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return state.status === "due";
  return state.status === filter;
}

const FILTERS: readonly RentFilter[] = ["all", "pending", "overdue", "paid"];

/** L04-SEG-FILTER from the URL; anything unrecognised is All (the default). */
export function parseRentFilter(value: string | null | undefined): RentFilter {
  return FILTERS.includes(value as RentFilter) ? (value as RentFilter) : "all";
}

/**
 * Which row actions show (L04-BTN-REMIND, L04-BTN-MARKPAID, L04-BTN-RECEIPT). Remind and Mark
 * paid stay while any balance is outstanding, so the balance of a part payment can be recorded;
 * only reaching Paid replaces them with the receipt (D-10).
 */
export function rowActions(state: RentState): { remind: boolean; markPaid: boolean; receipt: boolean } {
  const paid = state.status === "paid";
  return { remind: !paid, markPaid: !paid, receipt: paid };
}

/** L04-STRIP-SUMMARY over the rows shown: expected, collected, outstanding. */
export function summarise(states: RentState[]): { expected: number; collected: number; outstanding: number } {
  return states.reduce(
    (sum, s) => ({
      expected: sum.expected + s.due,
      collected: sum.collected + s.paid,
      outstanding: sum.outstanding + s.balance,
    }),
    { expected: 0, collected: 0, outstanding: 0 },
  );
}
