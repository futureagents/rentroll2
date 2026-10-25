"use client";

import { useState } from "react";

import { SidePanel } from "@/components/shell/detail-panel-host";
import { PageHeader } from "@/components/shell/page-header";
import { StatGrid } from "@/components/shell/stat-grid";
import {
  Button,
  DataTable,
  RowActions,
  SegmentedChoice,
  StatCard,
  StatusChip,
  formatDate,
  formatRupees,
  formatRupeesShort,
  type Column,
} from "@/components/ui";

type Row = { id: string; unit: string; tenant: string; due: string; amount: number; status: "Paid" | "Due" | "Overdue" };

const ROWS: Row[] = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  unit: `Flat ${Math.floor(i / 4) + 1}${"ABCD"[i % 4]}`,
  tenant: ["Asha Rao", "Vikram Nair", "Meera Iyer", "Rahul Sen"][i % 4],
  due: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
  amount: 12000 + i * 500,
  status: (["Paid", "Due", "Overdue"] as const)[i % 3],
}));

const TONE = { Paid: "success", Due: "warning", Overdue: "danger" } as const;

export function ShellDemo() {
  const [filter, setFilter] = useState<"all" | "due" | "overdue">("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [dirty, setDirty] = useState(false);

  const rows = ROWS.filter((r) => filter === "all" || r.status.toLowerCase() === filter);

  const columns: Column<Row>[] = [
    { id: "unit", header: "Unit", cell: (r) => r.unit, sortValue: (r) => r.unit, key: true },
    { id: "tenant", header: "Tenant", cell: (r) => r.tenant, sortValue: (r) => r.tenant },
    { id: "due", header: "Due", cell: (r) => formatDate(r.due), sortValue: (r) => r.due },
    { id: "amount", header: "Amount", cell: (r) => formatRupees(r.amount), sortValue: (r) => r.amount, align: "right", key: true },
    { id: "status", header: "Status", cell: (r) => <StatusChip tone={TONE[r.status]}>{r.status}</StatusChip>, key: true },
    {
      id: "actions",
      header: "",
      actions: true,
      cell: (r) => (
        <RowActions>
          <Button variant="quiet" size={32} onClick={() => setSelected(r)}>
            Open
          </Button>
        </RowActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Shell demo"
        action={<Button>Primary action</Button>}
        filters={
          <SegmentedChoice
            label="Status"
            hideLabel
            options={[
              { value: "all", label: "All" },
              { value: "due", label: "Due" },
              { value: "overdue", label: "Overdue" },
            ]}
            value={filter}
            onChange={setFilter}
            size={32}
          />
        }
      />
      <section className="flex flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <StatGrid>
          <StatCard label="Occupied" value="12 / 14" comparison="2 vacant" href="/units" />
          <StatCard label="Collected this month" value={formatRupeesShort(210000)} comparison={`${formatRupeesShort(186000)} last month`} href="/rent" />
          <StatCard label="Outstanding" value={formatRupeesShort(36000)} comparison="across 2 units" tone="danger" href="/rent" />
          <StatCard label="Agreements expiring" value="2" tone="warning" href="/agreements" />
        </StatGrid>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          caption="Rent due this month (demo)"
          selectedKey={selected?.id ?? null}
          onRowClick={setSelected}
          mobileTitle={(r) => `${r.unit} · ${r.tenant}`}
        />
      </section>
      <SidePanel
        open={selected !== null}
        onClose={() => {
          setSelected(null);
          setDirty(false);
        }}
        title={selected ? `${selected.unit} · ${selected.tenant}` : ""}
        subtitle={selected ? `Due ${formatDate(selected.due)}` : undefined}
        dirty={dirty}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDirty((d) => !d)}>
              {dirty ? "Mark clean" : "Make dirty"}
            </Button>
            <Button>Mark paid</Button>
          </>
        }
      >
        {selected ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <dt className="text-label uppercase text-muted">Amount</dt>
            <dd className="text-right tabular-nums">{formatRupees(selected.amount)}</dd>
            <dt className="text-label uppercase text-muted">Status</dt>
            <dd className="text-right"><StatusChip tone={TONE[selected.status]}>{selected.status}</StatusChip></dd>
          </dl>
        ) : null}
      </SidePanel>
    </>
  );
}
