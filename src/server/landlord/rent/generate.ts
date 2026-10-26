import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  firstOfMonth,
  isFirstOfMonthInKolkata,
  kolkataToday,
  lastOfMonth,
  monthOf,
  type IsoDate,
  type MonthKey,
} from "@/app/(landlord)/rent/_lib/calendar";
import { planRentRows, type SkippedTenancy, type TenancyForRent } from "@/app/(landlord)/rent/_lib/generate";

// D-24 rent row creation. One code path for the 1st-of-month job (service role, every landlord)
// and L04-BNR-ROWSMISSING's "create them now" (the landlord's own session, RLS-scoped).
// Idempotency is the database's unique (tenancy_id, month) with ON CONFLICT DO NOTHING: no
// existence check, so the job, a retry and a double-clicked banner can all run at once safely,
// and a row that already exists is never altered (renewals do not touch generated rows, D-08).

interface TenancyRow {
  id: string;
  unit_id: string;
  moved_in_on: IsoDate;
  ended_on: IsoDate | null;
}

interface AgreementRow {
  id: string;
  tenancy_id: string;
  starts_on: IsoDate;
  ends_on: IsoDate;
  rent: number;
  rent_due_day: number;
}

/** Tenancies that could owe rent for `month`, with their agreements. RLS scopes a landlord client. */
async function loadTenancies(db: SupabaseClient, month: MonthKey): Promise<TenancyForRent[]> {
  const first = firstOfMonth(month);
  const { data: tenancies, error } = await db
    .from("tenancy")
    .select("id, unit_id, moved_in_on, ended_on")
    .lte("moved_in_on", lastOfMonth(month));
  if (error) throw new Error(error.message);
  const live = (tenancies as TenancyRow[]).filter((t) => t.ended_on === null || t.ended_on >= first);
  if (live.length === 0) return [];

  const { data: agreements, error: agreementError } = await db
    .from("agreement")
    .select("id, tenancy_id, starts_on, ends_on, rent, rent_due_day")
    .in(
      "tenancy_id",
      live.map((t) => t.id),
    );
  if (agreementError) throw new Error(agreementError.message);

  return live.map((t) => ({
    id: t.id,
    unitId: t.unit_id,
    movedInOn: t.moved_in_on,
    endedOn: t.ended_on,
    agreements: (agreements as AgreementRow[])
      .filter((a) => a.tenancy_id === t.id)
      .map((a) => ({ id: a.id, startsOn: a.starts_on, endsOn: a.ends_on, rent: a.rent, rentDueDay: a.rent_due_day })),
  }));
}

export interface GenerateResult {
  planned: number;
  created: number;
  skipped: SkippedTenancy[];
}

export async function generateRentRows(db: SupabaseClient, month: MonthKey): Promise<GenerateResult> {
  const { rows, skipped } = planRentRows(month, await loadTenancies(db, month));
  if (rows.length === 0) return { planned: 0, created: 0, skipped };

  const { data, error } = await db
    .from("rent_entry")
    .upsert(rows, { onConflict: "tenancy_id,month", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return { planned: rows.length, created: (data ?? []).length, skipped };
}

/** L04-BNR-ROWSMISSING: how many rows the month should have but does not. */
export async function missingRentRows(db: SupabaseClient, month: MonthKey): Promise<number> {
  const { rows } = planRentRows(month, await loadTenancies(db, month));
  if (rows.length === 0) return 0;
  const { data, error } = await db
    .from("rent_entry")
    .select("tenancy_id")
    .eq("month", firstOfMonth(month))
    .in(
      "tenancy_id",
      rows.map((r) => r.tenancy_id),
    );
  if (error) throw new Error(error.message);
  const existing = new Set((data as { tenancy_id: string }[]).map((r) => r.tenancy_id));
  return rows.filter((r) => !existing.has(r.tenancy_id)).length;
}

export type MonthlyJobResult =
  | { ran: false; reason: "not_first_in_kolkata"; kolkataDate: IsoDate }
  | ({ ran: true; month: MonthKey } & GenerateResult);

/**
 * The 1st-of-month job (D-24). Pass the service-role client: it creates rows for every landlord.
 * It runs only while it is the 1st in Asia/Kolkata, whatever the scheduler's clock says, so a
 * UTC schedule of `30 18 * * *` (00:00 IST daily) or anything coarser is safe to point at it.
 */
export async function runMonthlyRentJob(db: SupabaseClient, now: Date): Promise<MonthlyJobResult> {
  const today = kolkataToday(now);
  if (!isFirstOfMonthInKolkata(now)) return { ran: false, reason: "not_first_in_kolkata", kolkataDate: today };
  const month = monthOf(today);
  return { ran: true, month, ...(await generateRentRows(db, month)) };
}
