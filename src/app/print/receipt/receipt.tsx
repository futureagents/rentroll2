// P-01 · Rent receipt (print view). spec/screens/P-01.md, D-03, D-10, D-12, D-19, D-26.
//
// Contents: landlord name and logo · receipt number · tenant · unit · month · amount in
// figures and words · date received · payment reference · payment QR · a signature line.
// Plus the landlord's PAN when present (tenants claiming HRA need it).
//
// Both routes — landlord `/print/receipt/:paymentId` and tenant
// `/u/:token/receipts/:receiptNumber/print` — render this one template (D-03, D-26). It takes
// props and never queries: the tenant route hands it D-30 columns only. Every optional element
// (logo, QR, PAN, reference) is omitted when absent, never shown as a placeholder (D-26).
import { formatDate, formatMonth, formatRupees, formatRupeesInWords } from "@/lib/format";

import { PrintPage, PrintSheet } from "../_lib/print-sheet";
import { QrSvg } from "../_lib/qr-svg";
import { buildUpiLink, receiptUpiNote } from "../_lib/upi";

export interface ReceiptLandlord {
  /** Name printed on receipts (L15-FLD-RECEIPTNAME); D-26 reads P-01's "landlord name" as this. */
  receiptName: string;
  /** L15-UPL-LOGO. Omitted when absent (D-26). */
  logoUrl?: string | null;
  /** L15-FLD-UPI. The payment QR is omitted when absent (D-26). */
  upiId?: string | null;
  /** Landlord PAN, printed when present so the tenant can claim HRA. */
  pan?: string | null;
}

export interface ReceiptProps {
  /** `payment.receipt_number`, e.g. "RR-0847" (D-12). */
  receiptNumber: string;
  /** `tenancy.name`. */
  tenantName: string;
  /** `unit.unit_number`. */
  unitNumber: string;
  /** `property.name`. */
  propertyName: string;
  /** `rent_entry.month` as `YYYY-MM` (D-10). */
  month: string;
  /** `payment.amount` in whole rupees (D-19). */
  amount: number;
  /** `payment.received_on` as `YYYY-MM-DD`. */
  receivedOn: string;
  /** `payment.reference`, optional. */
  reference?: string | null;
  landlord: ReceiptLandlord;
  /** Trigger the print dialog on load (the P-01 rule). Default true. */
  autoPrint?: boolean;
}

export function Receipt({
  receiptNumber,
  tenantName,
  unitNumber,
  propertyName,
  month,
  amount,
  receivedOn,
  reference,
  landlord,
  autoPrint = true,
}: ReceiptProps) {
  const upiId = landlord.upiId?.trim();
  const upiLink = upiId
    ? buildUpiLink({ upiId, payeeName: landlord.receiptName, note: receiptUpiNote(unitNumber) })
    : null;
  const pan = landlord.pan?.trim().toUpperCase();

  return (
    <PrintSheet autoPrint={autoPrint}>
      <PrintPage className="flex flex-col gap-8">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div className="flex items-center gap-4">
            {landlord.logoUrl && (
              // Plain <img>: the logo is the landlord's upload and must print as-is.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={landlord.logoUrl} alt="" className="h-16 w-16 object-contain" />
            )}
            <div className="flex flex-col gap-1">
              <p className="text-h1 text-ink">{landlord.receiptName}</p>
              {pan && (
                <p className="text-small text-muted">
                  PAN <span className="text-body">{pan}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <h1 className="text-label uppercase text-muted">Rent receipt</h1>
            <p className="text-h1 text-ink">{receiptNumber}</p>
          </div>
        </header>

        <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-4">
          <Row label="Received from">{tenantName}</Row>
          <Row label="Unit">
            {unitNumber}, {propertyName}
          </Row>
          <Row label="Rent for">{formatMonth(month)}</Row>
          <Row label="Amount">
            <span className="text-h1 text-ink">{formatRupees(amount)}</span>
          </Row>
          <Row label="In words">{formatRupeesInWords(amount)}</Row>
          <Row label="Date received">{formatDate(receivedOn)}</Row>
          {reference?.trim() && <Row label="Payment reference">{reference.trim()}</Row>}
        </dl>

        <footer className="mt-auto flex items-end justify-between gap-8 border-t border-line pt-6">
          {upiLink ? (
            <div className="flex items-center gap-4">
              <QrSvg value={upiLink} sizeMm={32} label={`UPI payment code for ${landlord.receiptName}`} />
              <div className="flex flex-col gap-1">
                <p className="text-small text-ink">Pay next month&apos;s rent by UPI</p>
                <p className="text-small text-muted">Scan with any UPI app</p>
                <p className="text-small text-muted">{upiId}</p>
              </div>
            </div>
          ) : (
            <div />
          )}
          <div className="flex w-56 flex-col gap-2">
            <div className="h-12 border-b border-ink" aria-hidden="true" />
            <p className="text-small text-muted">Signature · {landlord.receiptName}</p>
          </div>
        </footer>
      </PrintPage>
    </PrintSheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-label uppercase text-muted">{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </>
  );
}
