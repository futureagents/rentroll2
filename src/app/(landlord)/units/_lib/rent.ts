// Rent rules as L-08…L-11 read them: the agreement in force (D-08), a rent entry's derived state
// (D-10), a tenancy's first rent row (D-24) and the paid-on-time percentage (L11-SEC-PAYMENTS).
//
// PROMOTE: rent rules — lane/rent derives the same state in rent/_lib/status.ts and plans rows in
// rent/_lib/generate.ts. Once those move to a shared rent module this file keeps only
// `onTimeRate` and imports the rest.
import { formatRupees } from "@/lib/format";
import type { ChipTone } from "@/components/ui";

import { daysBetween, daysInMonth, dueOnFor, firstOfMonth, monthOf, type IsoDate } from "./dates";

export interface AgreementTerm {
  id: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
  rent: number;
  rentDueDay: number;
}

/**
 * D-08: the agreement in force on `date` is the one whose range contains it. Past the last
 * `ends_on` the last agreement stays in force at its rent; in a gap the earlier term carries on.
 * Before the first term starts, nothing is in force.
 */
export function agreementInForce<A extends Pick<AgreementTerm, "startsOn" | "endsOn">>(
  agreements: A[],
  date: IsoDate,
): A | null {
  const started = agreements.filter((a) => a.startsOn <= date).sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1));
  return started.find((a) => a.endsOn >= date) ?? started[0] ?? null;
}

/**
 * L11-SEC-AGREEMENT: the current term, earlier terms beneath it newest first (D-08), and any
 * renewal already recorded to start later. Before the first term starts, it is the current one.
 */
export function orderTerms<A extends Pick<AgreementTerm, "startsOn" | "endsOn">>(
  agreements: A[],
  today: IsoDate,
): { current: A | null; earlier: A[]; upcoming: A[] } {
  const byStart = [...agreements].sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1));
  const current = agreementInForce(agreements, today) ?? byStart[0] ?? null;
  if (!current) return { current: null, earlier: [], upcoming: [] };
  const earlier = byStart.filter((a) => a.startsOn < current.startsOn).reverse();
  const upcoming = byStart.filter((a) => a.startsOn > current.startsOn);
  return { current, earlier, upcoming };
}

export interface PaymentRecord {
  amount: number;
  status: "recorded" | "voided";
  receivedOn: IsoDate;
}

export interface RentEntryRecord {
  amountDue: number;
  dueOn: IsoDate;
  payments: PaymentRecord[];
}

export type RentStatus = "paid" | "due" | "overdue";

export interface RentState {
  status: RentStatus;
  paid: number;
  balance: number;
  daysLate: number;
}

/** D-10: derived from the sum of recorded payments; voided payments never count (D-11). */
export function rentState(entry: RentEntryRecord, today: IsoDate): RentState {
  const paid = entry.payments.filter((p) => p.status === "recorded").reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, entry.amountDue - paid);
  if (balance === 0) return { status: "paid", paid, balance, daysLate: 0 };
  const late = daysBetween(entry.dueOn, today);
  return { status: late > 0 ? "overdue" : "due", paid, balance, daysLate: Math.max(0, late) };
}

/** The L04-CHP-STATUS words and tones, so L-09 and L-11 read the same as the rent board. */
export function rentChip(state: RentState): { tone: ChipTone; label: string; sub: string | null } {
  const sub = state.status !== "paid" && state.paid > 0 ? `Part paid — ${formatRupees(state.balance)} pending` : null;
  if (state.status === "paid") return { tone: "success", label: "Paid", sub: null };
  if (state.status === "due") return { tone: "neutral", label: "Due", sub };
  const label = state.daysLate === 1 ? "1 day late" : `${state.daysLate} days late`;
  return { tone: state.daysLate >= 10 ? "danger" : "warning", label, sub };
}

/**
 * L11-SEC-PAYMENTS paid-on-time percentage.
 *
 * "On time" means paid on or before the due date: the payments received on or before `due_on`
 * cover the whole amount due. A month counts once it is settled or its due date has passed; a
 * month still inside its due date and not yet paid is left out rather than counted as late.
 * Voided payments never count. Returns `percent: null` while no month counts yet.
 */
export function onTimeRate(
  entries: RentEntryRecord[],
  today: IsoDate,
): { onTime: number; counted: number; percent: number | null } {
  let onTime = 0;
  let counted = 0;
  for (const entry of entries) {
    const recorded = entry.payments.filter((p) => p.status === "recorded");
    const paid = recorded.reduce((sum, p) => sum + p.amount, 0);
    const settled = paid >= entry.amountDue;
    if (!settled && entry.dueOn >= today) continue;
    counted += 1;
    const byDueDate = recorded.filter((p) => p.receivedOn <= entry.dueOn).reduce((sum, p) => sum + p.amount, 0);
    if (byDueDate >= entry.amountDue) onTime += 1;
  }
  return { onTime, counted, percent: counted === 0 ? null : Math.round((onTime / counted) * 100) };
}

/** The tooltip beside the percentage. It is the definition, word for word. */
export const ON_TIME_DEFINITION = "On time means paid in full on or before the due date.";

/** D-24: rent × (days in month − move-in day + 1) ÷ days in month, rounded half up (D-19). */
export function proRataAmount(rent: number, moveInDay: number, monthDays: number): number {
  const days = monthDays - moveInDay + 1;
  return Math.floor((2 * rent * days + monthDays) / (2 * monthDays));
}

export interface FirstRentRow {
  month: IsoDate;
  amount_due: number;
  due_on: IsoDate;
  is_pro_rata: boolean;
}

/**
 * D-24, D-39: saving the tenant form creates the tenancy's first rent row, for the move-in month.
 * Moving in on the 1st gives a full row due on the agreement's due day (D-09); any later day
 * gives a pro-rata row due on the move-in date. The agreement is the one the form just created.
 */
export function firstRentRow(movedInOn: IsoDate, agreement: Pick<AgreementTerm, "rent" | "rentDueDay">): FirstRentRow {
  const month = monthOf(movedInOn);
  const day = Number(movedInOn.slice(8, 10));
  if (day === 1) {
    return { month: firstOfMonth(month), amount_due: agreement.rent, due_on: dueOnFor(month, agreement.rentDueDay), is_pro_rata: false };
  }
  return {
    month: firstOfMonth(month),
    amount_due: proRataAmount(agreement.rent, day, daysInMonth(month)),
    due_on: movedInOn,
    is_pro_rata: true,
  };
}
