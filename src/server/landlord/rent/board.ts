import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { firstOfMonth, monthOf, type IsoDate, type MonthKey } from "@/app/(landlord)/rent/_lib/calendar";
import type { ReminderMessage } from "@/app/(landlord)/rent/_lib/timeline";
import type {
  BoardEntry,
  BoardPayment,
  RentBoardData,
  RentEntryDetail,
} from "@/app/(landlord)/rent/_lib/types";

// Reads for L-04 and L-05 through the landlord's RLS-scoped client. Flat queries joined here
// rather than PostgREST embeds: rent_entry and payment each have two composite foreign keys to
// their parent, which makes embedding ambiguous.

interface EntryRow {
  id: string;
  tenancy_id: string;
  unit_id: string;
  month: IsoDate;
  amount_due: number;
  due_on: IsoDate;
  is_pro_rata: boolean;
}

interface PaymentRow {
  id: string;
  rent_entry_id: string;
  amount: number;
  received_on: IsoDate;
  reference: string | null;
  receipt_number: string;
  status: "recorded" | "voided";
  created_at: string;
}

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

const toPayment = (p: PaymentRow): BoardPayment => ({
  id: p.id,
  amount: p.amount,
  receivedOn: p.received_on,
  reference: p.reference,
  receiptNumber: p.receipt_number,
  status: p.status,
  createdAt: p.created_at,
});

async function hydrate(db: SupabaseClient, entries: EntryRow[]): Promise<BoardEntry[]> {
  if (entries.length === 0) return [];
  const ids = entries.map((e) => e.id);
  const [tenancies, units, payments] = await Promise.all([
    db.from("tenancy").select("id, name, phone").in("id", [...new Set(entries.map((e) => e.tenancy_id))]),
    db.from("unit").select("id, unit_number, property_id").in("id", [...new Set(entries.map((e) => e.unit_id))]),
    db
      .from("payment")
      .select("id, rent_entry_id, amount, received_on, reference, receipt_number, status, created_at")
      .in("rent_entry_id", ids)
      .order("created_at"),
  ]);
  const tenancyById = new Map(must(tenancies).map((t: { id: string; name: string; phone: string }) => [t.id, t]));
  const unitRows = must(units) as { id: string; unit_number: string; property_id: string }[];
  const unitById = new Map(unitRows.map((u) => [u.id, u]));
  const properties = must(
    await db.from("property").select("id, name").in("id", [...new Set(unitRows.map((u) => u.property_id))]),
  ) as { id: string; name: string }[];
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const paymentRows = must(payments) as PaymentRow[];

  return entries.map((e) => {
    const unit = unitById.get(e.unit_id);
    const tenancy = tenancyById.get(e.tenancy_id);
    return {
      id: e.id,
      month: monthOf(e.month),
      amountDue: e.amount_due,
      dueOn: e.due_on,
      isProRata: e.is_pro_rata,
      unitNumber: unit?.unit_number ?? "",
      propertyId: unit?.property_id ?? "",
      propertyName: propertyById.get(unit?.property_id ?? "")?.name ?? "",
      tenantName: tenancy?.name ?? "",
      tenantPhone: tenancy?.phone ?? "",
      payments: paymentRows.filter((p) => p.rent_entry_id === e.id).map(toPayment),
    };
  });
}

const ENTRY_COLUMNS = "id, tenancy_id, unit_id, month, amount_due, due_on, is_pro_rata";

export async function loadRentBoard(db: SupabaseClient, month: MonthKey): Promise<RentBoardData> {
  const [entries, properties, units] = await Promise.all([
    db.from("rent_entry").select(ENTRY_COLUMNS).eq("month", firstOfMonth(month)),
    db.from("property").select("id, name").order("name"),
    db.from("unit").select("id", { count: "exact", head: true }),
  ]);
  if (units.error) throw new Error(units.error.message);
  const rows = await hydrate(db, must(entries) as EntryRow[]);
  rows.sort(
    (a, b) =>
      a.propertyName.localeCompare(b.propertyName) ||
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
  );
  return { month, entries: rows, properties: must(properties) as { id: string; name: string }[], hasUnits: (units.count ?? 0) > 0 };
}


/** L-05. Null when RLS does not return the entry (another landlord's, or gone): "Not found" (E4-5). */
export async function loadRentEntry(db: SupabaseClient, entryId: string): Promise<RentEntryDetail | null> {
  const entry = must(await db.from("rent_entry").select(ENTRY_COLUMNS).eq("id", entryId).maybeSingle()) as EntryRow | null;
  if (!entry) return null;
  const [[hydrated], messages, audits, properties] = await Promise.all([
    hydrate(db, [entry]),
    db
      .from("message")
      .select("id, kind, channel, level, call_outcome, call_note, confirmed_at")
      .eq("rent_entry_id", entryId)
      .in("kind", ["rent_reminder", "call", "payment_link"])
      .order("confirmed_at"),
    db
      .from("audit_event")
      .select("id, kind, old_value, new_value, note, created_at")
      .eq("entity_type", "rent_entry")
      .eq("entity_id", entryId)
      .order("created_at"),
    db.from("property").select("id", { count: "exact", head: true }),
  ]);
  if (properties.error) throw new Error(properties.error.message);

  return {
    ...hydrated,
    multipleProperties: (properties.count ?? 0) > 1,
    messages: (must(messages) as Record<string, unknown>[]).map((m) => ({
      id: String(m.id),
      kind: m.kind as ReminderMessage["kind"],
      channel: m.channel as ReminderMessage["channel"],
      level: (m.level as number | null) ?? null,
      callOutcome: (m.call_outcome as string | null) ?? null,
      callNote: (m.call_note as string | null) ?? null,
      confirmedAt: String(m.confirmed_at),
    })),
    audits: (must(audits) as Record<string, unknown>[]).map((a) => ({
      id: String(a.id),
      kind: String(a.kind),
      oldValue: a.old_value,
      newValue: a.new_value,
      note: (a.note as string | null) ?? null,
      createdAt: String(a.created_at),
    })),
  };
}
