// Unit and tenancy status for L-08, L-09, L-10 and L-11.
//
// Unit (L08-CHP-STATUS, and the L-09 header chip by the same rule): Occupied (success) ·
// Vacant (neutral) · Notice period (warning). A unit is occupied while it has an active tenancy
// (D-05: End tenancy makes it vacant at once); "Notice period" is an active tenancy with a vacate
// date recorded (D-13).
//
// Tenancy (L10-TBL-TENANTS Status, L10-SEG-FILTER, L11 header): Current · On notice · Past, the
// same three words as the filter segments, and each tenancy is exactly one of them. Past is
// `ended` or `settled` (D-05).
import type { ChipTone } from "@/components/ui";

import type { IsoDate } from "./dates";

export type TenancyStatus = "active" | "ended" | "settled";

export type UnitOccupancy = "occupied" | "vacant" | "notice";
export type TenancyStanding = "current" | "on_notice" | "past";

export interface TenancyForStatus {
  status: TenancyStatus;
  noticeVacateOn: IsoDate | null;
}

/** The unit's status from its active tenancy, or `null` when it has none. */
export function unitOccupancy(active: TenancyForStatus | null): UnitOccupancy {
  if (!active || active.status !== "active") return "vacant";
  return active.noticeVacateOn ? "notice" : "occupied";
}

export function tenancyStanding(tenancy: TenancyForStatus): TenancyStanding {
  if (tenancy.status !== "active") return "past";
  return tenancy.noticeVacateOn ? "on_notice" : "current";
}

export const OCCUPANCY_CHIP: Record<UnitOccupancy, { tone: ChipTone; label: string }> = {
  occupied: { tone: "success", label: "Occupied" },
  vacant: { tone: "neutral", label: "Vacant" },
  notice: { tone: "warning", label: "Notice period" },
};

export const STANDING_CHIP: Record<TenancyStanding, { tone: ChipTone; label: string }> = {
  current: { tone: "success", label: "Current" },
  on_notice: { tone: "warning", label: "On notice" },
  past: { tone: "neutral", label: "Past" },
};

/** L10-SEG-FILTER, in the order shown. Current is the default. */
export const STANDING_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "on_notice", label: "On notice" },
  { value: "past", label: "Past" },
] as const satisfies readonly { value: TenancyStanding; label: string }[];

export function parseStanding(value: string | string[] | null | undefined): TenancyStanding {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "on_notice" || v === "past" ? v : "current";
}
