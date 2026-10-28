import { EmptyState, Icon } from "@/components/ui";
import { formatRupees } from "@/lib/format";
import type { MyReceiptsView } from "@/server/tenant";

import { TenantPageFrame } from "./tenant-page";

// T-05 · My receipts (/u/:token/receipts, D-03). Month · amount · receipt number · print, for this
// tenancy's recorded payments (T05-LST-RECEIPTS). The amounts are the G-2 exception D-26 records:
// the tenant's own payments, and nothing else with a rupee sign appears on any tenant page.
// T05-BTN-PRINT opens P-01 at /u/:token/receipts/:receiptNumber/print, 48×48 (D-26, A4).

export const MY_RECEIPTS_TITLE = "My receipts";

export function MyReceiptsScreen({ basePath, view }: { basePath: string; view: MyReceiptsView }) {
  return (
    <TenantPageFrame basePath={basePath} header={view.header} page="receipts" title={MY_RECEIPTS_TITLE}>
      {view.receipts.length === 0 ? (
        // E2 (T-05): no action offered.
        <EmptyState message="Receipts appear here once your landlord records a payment." />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface shadow-1">
          {view.receipts.map((receipt) => (
            <li key={receipt.receiptNumber} className="flex items-center gap-3 py-2 pl-4 pr-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-ink">{receipt.month}</span>
                <span className="text-small text-muted">Receipt {receipt.receiptNumber}</span>
              </div>
              <span className="whitespace-nowrap font-semibold tabular-nums text-ink">{formatRupees(receipt.amount)}</span>
              <a
                href={`${basePath}/receipts/${encodeURIComponent(receipt.receiptNumber)}/print`}
                aria-label={`Print receipt ${receipt.receiptNumber} for ${receipt.month}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="print" size={20} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </TenantPageFrame>
  );
}
