// L15-UPL-LOGO and L15-UPL-SIGNATURE † preview: a P-01 receipt as it will print, not the images
// as squares. Same sizes as src/app/print/receipt/receipt.tsx — a 64px logo box with
// object-contain beside the receipt name at the top, the signature above a 224px line at the
// bottom — so a wide or tall image shows exactly the letterboxing the printer will. Shown twice:
// in colour, and on a black-and-white printer, where a pale logo or signature disappears.
// Integration requirement (lane PR): P-01 exports its header and signature block so this renders
// the same components.

export function ReceiptPreview({
  receiptName,
  logoUrl,
  signatureUrl,
}: {
  receiptName: string;
  logoUrl: string | null;
  signatureUrl: string | null;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-label uppercase text-muted">How a receipt you print will look</figcaption>
      <div className="grid gap-3 sm:grid-cols-2">
        <Sheet receiptName={receiptName} logoUrl={logoUrl} signatureUrl={signatureUrl} caption="Colour printer" />
        <Sheet
          receiptName={receiptName}
          logoUrl={logoUrl}
          signatureUrl={signatureUrl}
          caption="Black-and-white printer"
          mono
        />
      </div>
      <p className="text-small text-muted">
        {logoUrl ? "" : "No logo: the receipt starts with your receipt name. "}
        {signatureUrl
          ? "The signature prints only on receipts you print. A tenant printing their own copy gets a blank line."
          : "No signature: the receipt ends with a blank line to sign by hand."}
      </p>
    </figure>
  );
}

function Sheet({
  receiptName,
  logoUrl,
  signatureUrl,
  caption,
  mono = false,
}: {
  receiptName: string;
  logoUrl: string | null;
  signatureUrl: string | null;
  caption: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        aria-hidden="true"
        className={`flex flex-col gap-4 overflow-hidden rounded-sm border border-line bg-surface p-4 shadow-1 ${mono ? "grayscale" : ""}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="flex min-w-0 items-center gap-4">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a local or signed URL, shown as it will print
              <img src={logoUrl} alt="" className="h-16 w-16 shrink-0 object-contain" />
            )}
            <p className="min-w-0 break-words text-h1 text-ink">{receiptName}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <p className="text-label uppercase text-muted">Rent receipt</p>
            <p className="text-h1 text-ink">RR-0001</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-2 w-2/3 rounded-sm bg-line" />
          <div className="h-2 w-1/2 rounded-sm bg-line" />
        </div>
        <div className="flex justify-end border-t border-line pt-4">
          <div className="flex w-56 max-w-full flex-col gap-2">
            <div className="flex h-12 items-end border-b border-ink">
              {signatureUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- a local or signed URL, shown as it will print
                <img src={signatureUrl} alt="" className="max-h-12 max-w-full object-contain object-left-bottom" />
              )}
            </div>
            <p className="text-small text-muted">Signature · {receiptName}</p>
          </div>
        </div>
      </div>
      <p className="text-small text-muted">{caption}</p>
    </div>
  );
}
