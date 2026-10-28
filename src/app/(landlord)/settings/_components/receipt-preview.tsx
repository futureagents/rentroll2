// L15-UPL-LOGO preview: the top of a P-01 receipt as it will print, not the logo as a square.
// Same sizes as src/app/print/receipt/receipt.tsx — a 64px box with object-contain beside the
// receipt name — so a wide or tall logo shows exactly the letterboxing the printer will. Shown
// twice: as printed in colour, and on a black-and-white printer, where a pale logo disappears.
// Integration requirement (lane PR): P-01 exports its header so this renders the same component.

export function ReceiptPreview({ receiptName, logoUrl }: { receiptName: string; logoUrl: string | null }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-label uppercase text-muted">How the top of a receipt will print</figcaption>
      <div className="grid gap-3 sm:grid-cols-2">
        <Sheet receiptName={receiptName} logoUrl={logoUrl} caption="Colour printer" />
        <Sheet receiptName={receiptName} logoUrl={logoUrl} caption="Black-and-white printer" mono />
      </div>
      {!logoUrl && <p className="text-small text-muted">No logo: the receipt starts with your receipt name.</p>}
    </figure>
  );
}

function Sheet({
  receiptName,
  logoUrl,
  caption,
  mono = false,
}: {
  receiptName: string;
  logoUrl: string | null;
  caption: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        aria-hidden="true"
        className={`overflow-hidden rounded-sm border border-line bg-surface p-4 shadow-1 ${mono ? "grayscale" : ""}`}
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
        <div className="flex flex-col gap-2 pt-4">
          <div className="h-2 w-2/3 rounded-sm bg-line" />
          <div className="h-2 w-1/2 rounded-sm bg-line" />
        </div>
      </div>
      <p className="text-small text-muted">{caption}</p>
    </div>
  );
}
