// S-01 · UPI payment link for S01-CHK-PAYLINK (D-27): `upi://pay?pa=…&pn=…&am=…&tn=…&cu=INR`.
// PROMOTE: UPI link builder → src/lib (shared with src/app/print/_lib/upi.ts, which builds the
// same shape without `am=` for P-01, and with S-02's payment link). Local copy until then.

/** The common UPI note limit (D-27). */
const UPI_NOTE_MAX = 50;

export function buildUpiPaymentLink(input: {
  upiId: string;
  payeeName: string;
  /** Whole rupees (D-19). */
  amount: number;
  note: string;
}): string {
  // encodeURIComponent, not URLSearchParams: spaces must be %20, not "+", which some UPI apps
  // show literally.
  const params: [string, string][] = [
    ["pa", input.upiId.trim()],
    ["pn", input.payeeName.trim()],
    ["am", String(Math.round(input.amount))],
    ["tn", Array.from(input.note.trim()).slice(0, UPI_NOTE_MAX).join("")],
    ["cu", "INR"],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
