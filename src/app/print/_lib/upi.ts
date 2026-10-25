// UPI intent links (D-26, D-27): `upi://pay?pa=…&pn=…&tn=…`. The receipt's QR carries the
// landlord's UPI ID, the receipt name and a note, and NO amount — "a convenience for next
// month, not a claim about what is owed" (D-26). S-02 builds the same shape with `am=` for a
// payment request; until that lane lands, this is the only UPI link builder in the product.

/** The common UPI note limit (D-27). */
export const UPI_NOTE_MAX = 50;

export interface UpiLinkInput {
  /** `name@handle` (L15-FLD-UPI). */
  upiId: string;
  /** Payee name shown by the payment app: the receipt name (L15-FLD-RECEIPTNAME). */
  payeeName: string;
  /** Transaction note, e.g. "Rent — Flat 2A" (D-26). Cut at UPI_NOTE_MAX characters. */
  note: string;
}

export function buildUpiLink({ upiId, payeeName, note }: UpiLinkInput): string {
  const params = new URLSearchParams({
    pa: upiId.trim(),
    pn: payeeName.trim(),
    tn: Array.from(note.trim()).slice(0, UPI_NOTE_MAX).join(""),
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

/** The P-01 note wording from D-26: "Rent — Flat 2A". */
export function receiptUpiNote(unitNumber: string): string {
  return `Rent — Flat ${unitNumber}`;
}
