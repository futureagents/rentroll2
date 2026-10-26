// Which rent rows a month should have (D-08, D-09, D-24). Pure planning only: the server module
// inserts the plan with ON CONFLICT DO NOTHING, so rows that already exist are never altered.
//
// PROMOTE: rent row planning — L-09's tenant form creates a tenancy's first row with the same
// rules (D-24, D-39); it belongs in a shared rent module.
import { daysInMonth, dueOnFor, firstOfMonth, lastOfMonth, type IsoDate, type MonthKey } from "./calendar";

export interface AgreementTerm {
  id: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
  rent: number;
  rentDueDay: number;
}

export interface TenancyForRent {
  id: string;
  unitId: string;
  movedInOn: IsoDate;
  endedOn: IsoDate | null;
  agreements: AgreementTerm[];
}

/** A `rent_entry` insert, in column names. `landlord_id` is derived by the t10 trigger. */
export interface PlannedRentRow {
  tenancy_id: string;
  unit_id: string;
  agreement_id: string;
  month: IsoDate;
  amount_due: number;
  due_on: IsoDate;
  is_pro_rata: boolean;
}

export interface SkippedTenancy {
  tenancyId: string;
  /** No agreement had started by the date that sets the amount; the landlord must add one. */
  reason: "no_agreement";
}

/**
 * D-08: the agreement in force on `date` is the one whose range contains it. Past the last
 * `ends_on` the last agreement stays in force at its rent (L-12: an expired agreement "stays there
 * until renewed or the tenancy is ended"); in a gap between terms the earlier term carries on in
 * the same way. Before the first term starts, nothing is in force.
 */
export function agreementInForce(agreements: AgreementTerm[], date: IsoDate): AgreementTerm | null {
  const started = agreements.filter((a) => a.startsOn <= date).sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1));
  return started.find((a) => a.endsOn >= date) ?? started[0] ?? null;
}

/**
 * D-24: rent × (days in month − move-in day + 1) ÷ days in month, rounded half up to the whole
 * rupee (D-19). Integer arithmetic, so no floating-point drift at .5.
 */
export function proRataAmount(rent: number, moveInDay: number, monthDays: number): number {
  const days = monthDays - moveInDay + 1;
  return Math.floor((2 * rent * days + monthDays) / (2 * monthDays));
}

/**
 * D-24. For each tenancy:
 * - occupying the unit on the 1st (moved in on or before it, not ended before it) → one full row
 *   at the rent of the agreement in force on the 1st, due on that agreement's due day (D-09).
 *   A tenancy that ends later in the month keeps the full row.
 * - moving in after the 1st but within the month → one pro-rata row, flagged, due on the move-in
 *   date, at the rent of the agreement in force on the move-in date.
 * - anything else (moved out before the 1st, moving in later) → nothing. A vacant unit has no
 *   tenancy for the month and so never gets a row.
 */
export function planRentRows(
  month: MonthKey,
  tenancies: TenancyForRent[],
): { rows: PlannedRentRow[]; skipped: SkippedTenancy[] } {
  const first = firstOfMonth(month);
  const last = lastOfMonth(month);
  const rows: PlannedRentRow[] = [];
  const skipped: SkippedTenancy[] = [];

  for (const tenancy of tenancies) {
    if (tenancy.endedOn !== null && tenancy.endedOn < first) continue;
    if (tenancy.movedInOn > last) continue;

    const proRata = tenancy.movedInOn > first;
    const pricedOn = proRata ? tenancy.movedInOn : first;
    const agreement = agreementInForce(tenancy.agreements, pricedOn);
    if (!agreement) {
      skipped.push({ tenancyId: tenancy.id, reason: "no_agreement" });
      continue;
    }

    rows.push({
      tenancy_id: tenancy.id,
      unit_id: tenancy.unitId,
      agreement_id: agreement.id,
      month: first,
      amount_due: proRata
        ? proRataAmount(agreement.rent, Number(tenancy.movedInOn.slice(8, 10)), daysInMonth(month))
        : agreement.rent,
      due_on: proRata ? tenancy.movedInOn : dueOnFor(month, agreement.rentDueDay),
      is_pro_rata: proRata,
    });
  }

  return { rows, skipped };
}
