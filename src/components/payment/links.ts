// S-02 · What the payment sheet encodes. The `upi://pay` link itself is `buildUpiLink` in
// src/lib/upi.ts (D-27); this file adds the per-app iOS links, the default note and the payee.
// Client-safe; imports nothing from src/server.
import { formatDate } from "@/lib/format";
import { unitName } from "@/lib/display/unit-label";
import { UPI_NOTE_MAX, buildUpiLink } from "@/lib/upi";

/** Who the money goes to, from the landlord's settings row (L15-FLD-UPI, D-20). */
export interface PaymentPayee {
  /** `landlord.upi_id`, `name@handle`. */
  upiId: string;
  /** Shown by the payment app: `receipt_name`, else the landlord's name (as S-01's sign-off). */
  name: string;
}

export interface LandlordPaymentRow {
  upi_id: string | null;
  receipt_name: string | null;
  name: string;
}

/** The payee from a `landlord` row, or null when no UPI ID is saved (S-02 rule: prompt, not a broken QR). */
export function payeeFromLandlord(row: LandlordPaymentRow): PaymentPayee | null {
  const upiId = row.upi_id?.trim();
  if (!upiId) return null;
  return { upiId, name: row.receipt_name?.trim() || row.name.trim() };
}

/**
 * S02-FLD-NOTE's rent default, in the spec's own shape: "Rent Feb 2026 — Flat 2A".
 * The bare unit name, not D-47's qualified label: the note is capped at UPI_NOTE_MAX (D-27) and a
 * long property name would push the month out.
 *
 * WARNING: the note is a convenience for the tenant, nothing more. Payment apps cut it (~50
 * characters), edit it, or drop it entirely, and the tenant can change it before paying. Never
 * match, reconcile or mark anything paid from the note arriving; the landlord marks paid
 * (S-02 rule, D-10).
 */
export function rentPaymentNote(month: string, unitNumber: string): string {
  // formatDate gives "01 Feb 2026"; the note wants the month and year only.
  return capPaymentNote(`Rent ${formatDate(month).slice(3)} — ${unitName(unitNumber)}`);
}

export function capPaymentNote(note: string): string {
  return Array.from(note.trim()).slice(0, UPI_NOTE_MAX).join("");
}

export interface PaymentRequest {
  payee: PaymentPayee;
  /** Whole rupees (D-19), as set in S02-FLD-AMOUNT. */
  amount: number;
  note: string;
}

/** The plain UPI intent link (D-27): what the QR carries, what Copy link copies, what Android opens. */
export function paymentLink({ payee, amount, note }: PaymentRequest): string {
  return buildUpiLink({ upiId: payee.upiId, payeeName: payee.name, amount, note });
}

/** The apps offered on iOS, each as its own button so a failure points at one app. */
export const IOS_PAYMENT_APPS = [
  { id: "gpay", label: "GPay", prefix: "gpay://upi/pay?" },
  { id: "phonepe", label: "PhonePe", prefix: "phonepe://pay?" },
  { id: "paytm", label: "Paytm", prefix: "paytmmp://pay?" },
] as const;

export type IosPaymentApp = (typeof IOS_PAYMENT_APPS)[number];

/**
 * iOS has no system UPI chooser, so `upi://` goes nowhere unless one app has claimed it. Each app
 * also answers its own scheme with the same query string.
 */
export function appPaymentLink(app: IosPaymentApp, upiLink: string): string {
  return app.prefix + upiLink.slice(upiLink.indexOf("?") + 1);
}
