import "server-only";

// S-01 · Loads a rent-reminder composer under the signed-in landlord's RLS (D-04): another
// landlord's entry returns zero rows and the composer says "Not found" (E4-5, E4-7). The
// pre-selected tone (D-41) and the stale-board note (D-41) are computed here so openers pass an
// id and nothing else.
import { daysBetween, staleBoardNote } from "@/components/composer/context-line";
import { parseLadderDays, preselectLevel } from "@/components/composer/ladder";
import type { LoadResult, RentReminderContext } from "@/components/composer/types";
import { buildUpiLink } from "@/lib/upi";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { indiaDate, todayInIndia } from "./india-date";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** D-41: latest of payment recorded, payment voided, rent-entry audit event, across the landlord. */
async function lastBoardUpdate(supabase: Supabase): Promise<string | null> {
  const [recorded, voided, edited] = await Promise.all([
    supabase.from("payment").select("created_at").order("created_at", { ascending: false }).limit(1),
    supabase
      .from("payment")
      .select("voided_at")
      .not("voided_at", "is", null)
      .order("voided_at", { ascending: false })
      .limit(1),
    supabase
      .from("audit_event")
      .select("created_at")
      .eq("entity_type", "rent_entry")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (recorded.error || voided.error || edited.error) throw new Error("board update lookup failed");
  const instants = [
    recorded.data[0]?.created_at,
    voided.data[0]?.voided_at,
    edited.data[0]?.created_at,
  ].filter((value): value is string => typeof value === "string");
  if (instants.length === 0) return null;
  const latest = instants.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
  return indiaDate(latest);
}

export async function loadRentReminder(rentEntryId: string): Promise<LoadResult> {
  if (!isUuid(rentEntryId)) return { ok: false, reason: "not_found" };
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "not_found" };

    const { data: entry, error } = await supabase
      .from("rent_entry")
      .select("id, month, amount_due, due_on, tenancy_id, unit_id, agreement_id")
      .eq("id", rentEntryId)
      .maybeSingle();
    if (error) throw error;
    if (!entry) return { ok: false, reason: "not_found" };

    const [landlord, tenancy, unit, agreement, properties, payments, messages, lastUpdateOn] =
      await Promise.all([
        supabase.from("landlord").select("name, receipt_name, upi_id, ladder_days").maybeSingle(),
        supabase.from("tenancy").select("name, phone, email").eq("id", entry.tenancy_id).maybeSingle(),
        supabase.from("unit").select("unit_number, property_id").eq("id", entry.unit_id).maybeSingle(),
        supabase.from("agreement").select("starts_on").eq("id", entry.agreement_id).maybeSingle(),
        supabase.from("property").select("id, name"),
        supabase.from("payment").select("amount, status").eq("rent_entry_id", entry.id),
        supabase
          .from("message")
          .select("kind")
          .eq("rent_entry_id", entry.id)
          .in("kind", ["rent_reminder", "call"]),
        lastBoardUpdate(supabase),
      ]);
    for (const result of [landlord, tenancy, unit, agreement, properties, payments, messages]) {
      if (result.error) throw result.error;
    }
    if (!landlord.data || !tenancy.data || !unit.data || !agreement.data) {
      return { ok: false, reason: "not_found" };
    }

    const ladderDays = parseLadderDays(landlord.data.ladder_days);
    if (!ladderDays) throw new Error("landlord.ladder_days is malformed");

    const paid = (payments.data ?? [])
      .filter((payment) => payment.status === "recorded")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const balance = entry.amount_due - paid;
    if (balance <= 0) return { ok: false, reason: "paid" };

    const remindersSent = (messages.data ?? []).filter((m) => m.kind === "rent_reminder").length;
    const callsLogged = (messages.data ?? []).filter((m) => m.kind === "call").length;
    const today = todayInIndia();
    const daysOverdue = daysBetween(entry.due_on, today);

    const propertyList = properties.data ?? [];
    const property = propertyList.find((p) => p.id === unit.data!.property_id);
    const unitLabel =
      propertyList.length > 1 && property
        ? `Flat ${unit.data.unit_number} · ${property.name}`
        : `Flat ${unit.data.unit_number}`;
    const signOff = landlord.data.receipt_name?.trim() || landlord.data.name;

    const context: RentReminderContext = {
      kind: "rent_reminder",
      rentEntryId: entry.id,
      recipient: {
        name: tenancy.data.name,
        firstName: tenancy.data.name.trim().split(/\s+/)[0] ?? tenancy.data.name,
        phone: tenancy.data.phone,
        email: tenancy.data.email ?? null,
      },
      unitLabel,
      month: entry.month,
      dueOn: entry.due_on,
      daysOverdue,
      amountDue: entry.amount_due,
      balance,
      ladderDays,
      remindersSent,
      callsLogged,
      preselectedLevel: preselectLevel({
        daysOverdue,
        ladderDays,
        contacts: remindersSent + callsLogged,
      }),
      agreementStartsOn: agreement.data.starts_on,
      signOff,
      payLink: landlord.data.upi_id
        ? buildUpiLink({
            upiId: landlord.data.upi_id,
            payeeName: signOff,
            amount: balance,
            note: `Rent — Flat ${unit.data.unit_number}`,
          })
        : null,
      staleNote: staleBoardNote({ lastUpdateOn, dueOn: entry.due_on, today }),
    };
    return { ok: true, context };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
