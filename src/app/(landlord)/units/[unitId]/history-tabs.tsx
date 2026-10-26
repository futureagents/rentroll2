"use client";
// L09-TAB-RENT: "Every month, every tenant, ever. Paid or not, and how much." — paid total per
// month (D-10), with the rent board's status words.
// L09-TAB-MAINT: "Every request against this unit, with cost", and the repeated-category note.
import { DataTable, EmptyState, Icon, StatusChip, type Column } from "@/components/ui";
import { formatDate, formatMonth, formatRupees } from "@/lib/format";

import type { UnitView } from "./view";

type RentRow = UnitView["rentRows"][number];
type RequestRow = UnitView["requests"][number];

export function RentTab({ rows }: { rows: RentRow[] }) {
  const columns: Column<RentRow>[] = [
    { id: "month", header: "Month", cell: (r) => formatMonth(r.month), sortValue: (r) => r.month },
    { id: "tenant", header: "Tenant", key: true, cell: (r) => r.tenantName, sortValue: (r) => r.tenantName.toLowerCase() },
    {
      id: "due",
      header: "Rent due",
      align: "right",
      key: true,
      cell: (r) => (
        <>
          {formatRupees(r.amountDue)}
          {r.isProRata && <span className="block text-small text-muted">Part month</span>}
        </>
      ),
      sortValue: (r) => r.amountDue,
    },
    { id: "paid", header: "Paid", align: "right", key: true, cell: (r) => formatRupees(r.paid), sortValue: (r) => r.paid },
    {
      id: "status",
      header: "Status",
      key: true,
      cell: (r) => (
        <span className="flex flex-col items-start gap-1 py-1">
          <StatusChip tone={r.chip.tone}>{r.chip.label}</StatusChip>
          {r.chip.sub && <span className="text-small text-muted">{r.chip.sub}</span>}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption="Rent history"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      mobileTitle={(r) => formatMonth(r.month)}
      empty={{ message: "Rent history appears here once a tenant moves in." }}
    />
  );
}

export function MaintenanceTab({ requests, notes }: { requests: RequestRow[]; notes: string[] }) {
  const columns: Column<RequestRow>[] = [
    { id: "number", header: "Request", cell: (r) => <span className="font-medium text-ink">{r.number}</span>, sortValue: (r) => r.number },
    { id: "reported", header: "Reported", key: true, cell: (r) => formatDate(r.reportedOn), sortValue: (r) => r.reportedOn },
    { id: "category", header: "Category", key: true, cell: (r) => r.category, sortValue: (r) => r.category },
    {
      id: "problem",
      header: "Problem",
      cell: (r) => <span className="line-clamp-1 max-w-[28ch] text-body" title={r.description}>{r.description}</span>,
    },
    { id: "status", header: "Status", key: true, cell: (r) => <StatusChip tone={r.status.tone}>{r.status.label}</StatusChip> },
    {
      id: "cost",
      header: "Cost",
      align: "right",
      key: true,
      cell: (r) => (r.cost !== null ? formatRupees(r.cost) : r.noCost ? "No cost" : <span className="text-muted">—</span>),
      sortValue: (r) => r.cost ?? 0,
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Repeated problems">
          {notes.map((note) => (
            <li key={note} className="flex items-center gap-2 text-small text-body">
              <Icon name="note" size={16} className="shrink-0 text-muted" />
              {note}
            </li>
          ))}
        </ul>
      )}
      {requests.length === 0 ? (
        <EmptyState message="No problems have been reported for this unit." />
      ) : (
        <DataTable caption="Maintenance history" columns={columns} rows={requests} rowKey={(r) => r.id} mobileTitle={(r) => `${r.number} · ${r.category}`} />
      )}
    </div>
  );
}
