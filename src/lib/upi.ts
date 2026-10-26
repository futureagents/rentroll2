// UPI intent links (D-26, D-27): `upi://pay?pa=…&pn=…&am=…&tn=…&cu=INR`. The one builder for
// P-01's receipt QR and S-01's payment link. P-01 passes no amount: the receipt QR is "a
// convenience for next month, not a claim about what is owed" (D-26). A payment request the
// landlord sends may carry one (D-27).

/** The common UPI note limit (D-27). */
export const UPI_NOTE_MAX = 50;

export interface UpiLinkInput {
  /** `name@handle` (L15-FLD-UPI). */
  upiId: string;
  /** Payee name shown by the payment app. */
  payeeName: string;
  /** Whole rupees (D-19). Omitted on P-01 (D-26). */
  amount?: number;
  /** Transaction note, e.g. "Rent — Flat 2A" (D-26). Cut at UPI_NOTE_MAX characters. */
  note: string;
}

export function buildUpiLink({ upiId, payeeName, amount, note }: UpiLinkInput): string {
  // encodeURIComponent, not URLSearchParams: spaces must be %20, not "+", which some UPI
  // apps show literally in the payee name and note.
  const params: [string, string][] = [
    ["pa", upiId.trim()],
    ["pn", payeeName.trim()],
    ...(amount === undefined ? [] : [["am", String(Math.round(amount))] as [string, string]]),
    ["tn", Array.from(note.trim()).slice(0, UPI_NOTE_MAX).join("")],
    ["cu", "INR"],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
