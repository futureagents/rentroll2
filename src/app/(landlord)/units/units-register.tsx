"use client";
// L-08 · Unit register. L08-TBL-UNITS (Unit · Property · Type · Rent · Current tenant · Status;
// row → L-09), L08-CHP-STATUS, L08-BTN-ADDUNIT, L08-BTN-PRINTQR, L08-CHK-SELECT, and the filter
// box (proposed decision: client-side, matches every column including the status word).
//
// L08-BTN-PRINTQR prints one card per selected unit; with nothing selected it prints every unit
// the current filter shows (proposed decision, the §9 L-06 precedent). Selection also enables the
// bulk export, `units.csv` (D-40).
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import {
  Button,
  DataTable,
  EmptyState,
  RowActions,
  StatusChip,
  ToastProvider,
  useToast,
  type Column,
} from "@/components/ui";
import { compareUnits, unitLabel, unitName } from "@/lib/display/unit-label";
import { formatRupees } from "@/lib/format";

import { FilterBox } from "./_components/filter-box";
import { OCCUPANCY_CHIP, unitOccupancy, type UnitOccupancy } from "./_lib/occupancy";
import { matchesText } from "./_lib/text-filter";
import { UNITS_CSV_FILENAME, unitsCsv } from "./_lib/units-csv";
import { AddUnitForm } from "./add-unit-form";

export interface RegisterUnit {
  id: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  type: string | null;
  rent: number;
  deposit: number;
  tenantName: string | null;
  activeTenancy: { status: "active" | "ended" | "settled"; noticeVacateOn: string | null } | null;
}

interface Row extends RegisterUnit {
  occupancy: UnitOccupancy;
  label: string;
}

export interface UnitRegisterProps {
  properties: { id: string; name: string }[];
  units: RegisterUnit[];
  initialQuery: string;
  /** `?add=1` opens the form; `?add=property` opens it on "Add a property…" (D-39). */
  initialAdd: "none" | "unit" | "property";
}

export function UnitRegister(props: UnitRegisterProps) {
  return (
    <ToastProvider>
      <Register {...props} />
    </ToastProvider>
  );
}

function Register({ properties, units, initialQuery, initialAdd }: UnitRegisterProps) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(initialAdd !== "none");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const rows: Row[] = useMemo(
    () =>
      [...units].sort(compareUnits).map((u) => ({
        ...u,
        occupancy: unitOccupancy(u.activeTenancy),
        label: unitLabel(u),
      })),
    [units],
  );
  const shown = useMemo(
    () =>
      rows.filter((r) =>
        matchesText(query, [r.label, r.propertyName, r.type, r.tenantName, OCCUPANCY_CHIP[r.occupancy].label]),
      ),
    [rows, query],
  );
  // Only rows the landlord can see count as selected, so a filter never prints hidden units.
  const selectedShown = shown.filter((r) => selected.has(r.id));
  const filtering = query.trim() !== "";

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const printQr = () => {
    const ids = (selectedShown.length > 0 ? selectedShown : shown).map((r) => r.id);
    const everything = selectedShown.length === 0 && !filtering;
    // P-03 opens in a new tab with the print dialog on load. Unit ids only: no token in the URL.
    window.open(everything ? "/print/door-qr" : `/print/door-qr?units=${ids.join(",")}`, "_blank", "noopener");
  };

  const exportSelected = () => {
    const csv = unitsCsv(
      selectedShown.map((r) => ({
        unitNumber: r.unitNumber,
        propertyName: r.propertyName,
        type: r.type,
        rent: r.rent,
        deposit: r.deposit,
        tenantName: r.tenantName,
        statusLabel: OCCUPANCY_CHIP[r.occupancy].label,
      })),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = UNITS_CSV_FILENAME;
    link.click();
    URL.revokeObjectURL(url);
    toast.show({ message: `Downloaded ${UNITS_CSV_FILENAME}` }); // E1-04
  };

  const columns: Column<Row>[] = [
    {
      id: "select",
      header: "Select",
      actions: true,
      width: "56px",
      cell: (row) => (
        <RowActions>
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggle(row.id)}
            aria-label={`Select ${row.label}`}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
        </RowActions>
      ),
    },
    { id: "unit", header: "Unit", cell: (r) => <span className="font-medium text-ink">{unitName(r.unitNumber)}</span>, sortValue: (r) => r.unitNumber },
    { id: "property", header: "Property", cell: (r) => r.propertyName, sortValue: (r) => r.propertyName.toLowerCase() },
    { id: "type", header: "Type", cell: (r) => r.type ?? <span className="text-muted">—</span>, sortValue: (r) => r.type ?? "" },
    { id: "rent", header: "Rent", align: "right", key: true, cell: (r) => formatRupees(r.rent), sortValue: (r) => r.rent },
    {
      id: "tenant",
      header: "Current tenant",
      key: true,
      cell: (r) => r.tenantName ?? <span className="text-muted">—</span>,
      sortValue: (r) => (r.tenantName ?? "").toLowerCase(),
    },
    {
      id: "status",
      header: "Status",
      key: true,
      cell: (r) => <StatusChip tone={OCCUPANCY_CHIP[r.occupancy].tone}>{OCCUPANCY_CHIP[r.occupancy].label}</StatusChip>,
      sortValue: (r) => OCCUPANCY_CHIP[r.occupancy].label,
    },
  ];

  const summary = filtering
    ? `${shown.length} of ${rows.length} units${selectedShown.length ? ` · ${selectedShown.length} selected` : ""}`
    : selectedShown.length
      ? `${selectedShown.length} selected`
      : undefined;

  const allShownSelected = shown.length > 0 && selectedShown.length === shown.length;

  return (
    <>
      <PageHeader
        title="Units"
        action={
          !adding && (
            <Button icon="plus" onClick={() => setAdding(true)}>
              Add unit
            </Button>
          )
        }
        filters={
          rows.length > 0 && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <FilterBox
                label="Filter units"
                placeholder="Filter by unit, property, tenant or status"
                value={query}
                onChange={setQuery}
                summary={summary}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="quiet"
                  size={32}
                  onClick={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((r) => r.id)))}
                >
                  {allShownSelected ? "Clear selection" : `Select all ${shown.length}`}
                </Button>
                {shown.length === 0 ? (
                  <Button variant="secondary" icon="print" disabled disabledReason="No units match the filter">
                    Print door QR codes
                  </Button>
                ) : (
                  <Button variant="secondary" icon="print" onClick={printQr}>
                    Print door QR codes
                  </Button>
                )}
                {selectedShown.length === 0 ? (
                  <Button variant="secondary" disabled disabledReason="Select units to export them">
                    Export selected
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={exportSelected}>
                    Export selected
                  </Button>
                )}
              </div>
            </div>
          )
        }
      />
      <section className="flex flex-col gap-4 p-4 lg:p-6">
        {adding && (
          <AddUnitForm
            properties={properties}
            units={units}
            startWithNewProperty={initialAdd === "property"}
            onCancel={() => setAdding(false)}
            onDone={(unitId) => {
              setAdding(false);
              setJustAdded(unitId);
              setQuery("");
              toast.show({ message: "Unit added." });
              router.refresh();
            }}
          />
        )}
        {rows.length === 0 ? (
          !adding && (
            <EmptyState
              message="Your properties and units live here."
              action={{ label: "Add your first unit", onClick: () => setAdding(true) }}
            />
          )
        ) : shown.length === 0 ? (
          <EmptyState message={`No units match “${query.trim()}”.`} action={{ label: "Clear filter", onClick: () => setQuery(""), variant: "secondary" }} />
        ) : (
          <DataTable
            caption="Units"
            columns={columns}
            rows={shown}
            rowKey={(r) => r.id}
            selectedKey={justAdded}
            onRowClick={(r) => router.push(`/units/${r.id}`)}
            mobileTitle={(r) => r.label}
          />
        )}
      </section>
    </>
  );
}
