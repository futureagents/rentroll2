// L04-BTN-EXPORT: "Downloads a CSV of the current filtered view. File named rent-2026-02.csv."
// D-40: amount columns headed "(₹)" with plain integer cells, `YYYY-MM-DD` dates, UTF-8 with BOM.
import { formatDateCsv } from "@/lib/format";

import type { IsoDate, MonthKey } from "./calendar";
import { rentChip, type RentState } from "./status";

export interface RentCsvRow {
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  dueOn: IsoDate;
  isProRata: boolean;
  state: RentState;
}

export function rentCsvFilename(month: MonthKey): string {
  return `rent-${month}.csv`;
}

/** RFC 4180 quoting, plus a leading apostrophe on text a spreadsheet would run as a formula. */
function cell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) || safe !== value ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const HEADER = ["Property", "Unit", "Tenant", "Rent (₹)", "Due date", "Status", "Paid (₹)", "Pending (₹)", "Pro-rata"];

export function rentCsv(rows: RentCsvRow[]): string {
  const lines = [
    HEADER.map(cell).join(","),
    ...rows.map((r) =>
      [
        cell(r.propertyName),
        cell(r.unitNumber),
        cell(r.tenantName),
        cell(r.state.due),
        cell(formatDateCsv(r.dueOn)),
        cell(rentChip(r.state).label),
        cell(r.state.paid),
        cell(r.state.balance),
        cell(r.isProRata ? "Yes" : "No"),
      ].join(","),
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
