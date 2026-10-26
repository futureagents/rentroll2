// P-01's UPI note (D-26). The link itself is built by `buildUpiLink` in src/lib/upi.ts, with no
// amount on a receipt.

/** The P-01 note wording from D-26: "Rent — Flat 2A". */
export function receiptUpiNote(unitNumber: string): string {
  return `Rent — Flat ${unitNumber}`;
}
