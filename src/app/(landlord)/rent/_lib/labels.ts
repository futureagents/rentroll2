// Display labels shared by the board and the panel.
import { formatMonth } from "@/lib/format";

import type { MonthKey } from "./calendar";

/** Units are written "Flat 2A" across the product (E1, D-26 "Rent — Flat 2A"). */
export function unitLabel(unitNumber: string): string {
  return `Flat ${unitNumber}`;
}

/** L05-HDR "Flat 2A · February 2026"; with the property when there are several (D-38). */
export function panelTitle(
  entry: { unitNumber: string; propertyName: string; month: MonthKey },
  multipleProperties: boolean,
): string {
  const parts = [unitLabel(entry.unitNumber)];
  if (multipleProperties) parts.push(entry.propertyName);
  parts.push(formatMonth(entry.month));
  return parts.join(" · ");
}
