// L-08 bulk export: the selected rows as `units.csv` (D-40). UTF-8 with a BOM so Excel renders ₹
// in the header; amount cells are plain integers with ₹ only in the header; columns mirror
// L08-TBL-UNITS. Units carry no dates, so the D-40 `YYYY-MM-DD` rule has nothing to apply to.
//
// PROMOTE: CSV writer (BOM, quoting, formula guard) — L-04 and L-14 exports need the same; it
// belongs in src/lib once a second lane writes one.

export const UNITS_CSV_FILENAME = "units.csv";

export interface UnitCsvRow {
  unitNumber: string;
  propertyName: string;
  type: string | null;
  rent: number;
  deposit: number;
  tenantName: string | null;
  statusLabel: string;
}

const HEADER = ["Unit", "Property", "Type", "Rent amount (₹)", "Deposit amount (₹)", "Current tenant", "Status"];

/** Quotes a cell when needed, and stops a typed `=…` from running as a spreadsheet formula. */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(Math.round(value));
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function unitsCsv(rows: UnitCsvRow[]): string {
  const lines = [HEADER, ...rows.map((r) => [r.unitNumber, r.propertyName, r.type, r.rent, r.deposit, r.tenantName, r.statusLabel])];
  return "﻿" + lines.map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
