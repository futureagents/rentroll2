"use client";
// L-10 · Tenant list. L10-TBL-TENANTS (Name · Unit · Phone · Agreement ends · Status; row → L-11)
// and L10-SEG-FILTER (Current · On notice · Past, default Current). The Status column uses the
// same three words as the segments (proposed decision). Beside the segments, the client-side
// filter box (proposed decision) narrows within the chosen segment.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { DataTable, EmptyState, SegmentedChoice, StatusChip, type Column } from "@/components/ui";
import { compareUnits, unitLabel } from "@/lib/display/unit-label";
import { formatDate, formatPhone } from "@/lib/format";

import { FilterBox } from "../units/_components/filter-box";
import { STANDING_CHIP, STANDING_OPTIONS, tenancyStanding, type TenancyStanding } from "../units/_lib/occupancy";
import { matchesText } from "../units/_lib/text-filter";

export interface TenantListRow {
  id: string;
  name: string;
  phone: string;
  unitNumber: string;
  propertyName: string;
  status: "active" | "ended" | "settled";
  noticeVacateOn: string | null;
  agreementEndsOn: string | null;
}

interface Row extends TenantListRow {
  standing: TenancyStanding;
  unit: string;
}

function byName(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

const SEGMENT_EMPTY: Record<TenancyStanding, string> = {
  current: "No current tenants. Tenants on notice are under On notice.",
  on_notice: "No one is on notice. Record notice from a tenant's page when they tell you they are leaving.",
  past: "Past tenants appear here once a tenancy ends.",
};

export function TenantList({
  tenants,
  initialStanding,
  initialQuery,
}: {
  tenants: TenantListRow[];
  initialStanding: TenancyStanding;
  initialQuery: string;
}) {
  const router = useRouter();
  const [standing, setStanding] = useState<TenancyStanding>(initialStanding);
  const [query, setQuery] = useState(initialQuery);

  const rows: Row[] = useMemo(
    () =>
      tenants
        .map((t) => ({ ...t, standing: tenancyStanding(t), unit: unitLabel(t) }))
        .sort((a, b) => byName(a.name, b.name) || compareUnits(a, b)),
    [tenants],
  );
  const inSegment = rows.filter((r) => r.standing === standing);
  const shown = inSegment.filter((r) => matchesText(query, [r.name, r.unit, r.phone, formatPhone(r.phone), STANDING_CHIP[r.standing].label]));
  const filtering = query.trim() !== "";

  const columns: Column<Row>[] = [
    { id: "name", header: "Name", cell: (r) => <span className="font-medium text-ink">{r.name}</span>, sortValue: (r) => r.name.toLowerCase() },
    { id: "unit", header: "Unit", key: true, cell: (r) => r.unit, sortValue: (r) => r.unit.toLowerCase() },
    { id: "phone", header: "Phone", key: true, cell: (r) => <span className="tabular-nums">{formatPhone(r.phone)}</span> },
    {
      id: "ends",
      header: "Agreement ends",
      key: true,
      cell: (r) => (r.agreementEndsOn ? formatDate(r.agreementEndsOn) : <span className="text-muted">—</span>),
      sortValue: (r) => r.agreementEndsOn ?? "",
    },
    {
      id: "status",
      header: "Status",
      key: true,
      cell: (r) => <StatusChip tone={STANDING_CHIP[r.standing].tone}>{STANDING_CHIP[r.standing].label}</StatusChip>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Tenants"
        filters={
          rows.length > 0 && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <SegmentedChoice
                label="Show"
                hideLabel
                options={STANDING_OPTIONS}
                value={standing}
                onChange={setStanding}
              />
              <FilterBox
                label="Filter tenants"
                placeholder="Filter by name, unit or phone"
                value={query}
                onChange={setQuery}
                summary={filtering ? `${shown.length} of ${inSegment.length} ${STANDING_CHIP[standing].label.toLowerCase()}` : undefined}
              />
            </div>
          )
        }
      />
      <section className="p-4 lg:p-6">
        {rows.length === 0 ? (
          // No E2 row for L-10 (decisions §9); the action follows E2-06, which routes to L-08 (D-39).
          <EmptyState message="Tenants appear here once you add one to a unit." action={{ label: "Add tenant", onClick: () => router.push("/units") }} />
        ) : shown.length === 0 ? (
          filtering ? (
            <EmptyState message={`No tenants match “${query.trim()}”.`} action={{ label: "Clear filter", onClick: () => setQuery(""), variant: "secondary" }} />
          ) : (
            <EmptyState message={SEGMENT_EMPTY[standing]} />
          )
        ) : (
          <DataTable
            caption={`${STANDING_CHIP[standing].label} tenants`}
            columns={columns}
            rows={shown}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/tenants/${r.id}`)}
            mobileTitle={(r) => r.name}
          />
        )}
      </section>
    </>
  );
}
