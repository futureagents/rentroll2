import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { IsoDate } from "@/app/(landlord)/rent/_lib/calendar";
import { planBulkPayments, validateAmountEdit, validatePayment } from "@/app/(landlord)/rent/_lib/payments";
import { deriveRentState, type PaymentForStatus } from "@/app/(landlord)/rent/_lib/status";
import { isCallOutcome } from "@/app/(landlord)/rent/_lib/timeline";

// Rent writes for L-04 and L-05 (D-10, D-11, D-14, D-17, D-25). Every function takes the
// landlord's own RLS-scoped client, so another landlord's rows are simply absent (E4-5).
//
// Supabase's REST API has no multi-statement transaction. Where a timeline must not lie by
// omission (amount edits, D-14 ★6) the write is guarded and undone if its audit row fails; the
// proper fix is one database function per action (listed under Integration requirements).

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_FOUND = "Not found.";
/** E1-07. */
const SAVE_FAILED = "Could not save. Your changes are still here — try again.";

interface EntryRow {
  id: string;
  tenancy_id: string;
  amount_due: number;
  due_on: IsoDate;
}

async function loadEntries(db: SupabaseClient, ids: string[], today: IsoDate) {
  const { data: entries, error } = await db
    .from("rent_entry")
    .select("id, tenancy_id, amount_due, due_on")
    .in("id", ids);
  if (error) return { error: error.message } as const;
  const { data: payments, error: paymentError } = await db
    .from("payment")
    .select("rent_entry_id, amount, status")
    .in("rent_entry_id", ids)
    .eq("status", "recorded");
  if (paymentError) return { error: paymentError.message } as const;

  const byId = new Map(
    (entries as EntryRow[]).map((e) => {
      const own = (payments as (PaymentForStatus & { rent_entry_id: string })[]).filter((p) => p.rent_entry_id === e.id);
      return [e.id, { ...e, state: deriveRentState({ amountDue: e.amount_due, dueOn: e.due_on }, own, today) }];
    }),
  );
  return { byId } as const;
}

async function audit(
  db: SupabaseClient,
  rows: {
    landlord_id: string;
    entity_type: string;
    entity_id: string;
    kind: string;
    old_value?: unknown;
    new_value?: unknown;
    note?: string | null;
  }[],
) {
  const { error } = await db.from("audit_event").insert(rows.map((r) => ({ actor: "landlord", ...r })));
  return error;
}

/**
 * L04-BTN-MARKPAID / L05-BTN-MARKPAID / bulk mark-paid: one payment row per amount received
 * (D-10). Each amount is checked against its row's balance immediately before the insert; all
 * rows go in a single INSERT statement, so a bulk batch is recorded entirely or not at all.
 * Receipt numbers are allocated by the database trigger (D-12), never chosen here.
 */
export async function recordPayments(
  db: SupabaseClient,
  landlordId: string,
  input: { items: { rentEntryId: string; amount: number }[]; receivedOn: IsoDate; reference: string; today: IsoDate },
): Promise<Result<{ payments: { id: string; rentEntryId: string; receiptNumber: string }[] }>> {
  const ids = input.items.map((i) => i.rentEntryId);
  if (ids.length === 0) return { ok: false, error: "Choose at least one month to mark paid." };
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Each month can appear only once." };

  const loaded = await loadEntries(db, ids, input.today);
  if ("error" in loaded) return { ok: false, error: SAVE_FAILED };

  for (const item of input.items) {
    const entry = loaded.byId.get(item.rentEntryId);
    if (!entry) return { ok: false, error: NOT_FOUND };
    const problem = validatePayment({
      amount: item.amount,
      receivedOn: input.receivedOn,
      balance: entry.state.balance,
      today: input.today,
    });
    if (problem) return { ok: false, error: problem };
  }

  const reference = input.reference.trim() || null;
  const { data, error } = await db
    .from("payment")
    .insert(
      input.items.map((i) => ({
        rent_entry_id: i.rentEntryId,
        amount: i.amount,
        received_on: input.receivedOn,
        reference,
      })),
    )
    .select("id, rent_entry_id, amount, receipt_number");
  if (error) return { ok: false, error: SAVE_FAILED };

  const inserted = data as { id: string; rent_entry_id: string; amount: number; receipt_number: string }[];
  // The payment row is itself the record of what was received; this event feeds activity views.
  await audit(
    db,
    inserted.map((p) => ({
      landlord_id: landlordId,
      entity_type: "payment",
      entity_id: p.id,
      kind: "payment_recorded",
      new_value: { rent_entry_id: p.rent_entry_id, amount: p.amount, received_on: input.receivedOn, receipt_number: p.receipt_number },
    })),
  );

  return {
    ok: true,
    payments: inserted.map((p) => ({ id: p.id, rentEntryId: p.rent_entry_id, receiptNumber: p.receipt_number })),
  };
}

/**
 * Bulk mark-paid: the client sends only which rows; each row's balance is read here, at the
 * moment of recording, so a stale screen can never overpay. Received today, no reference.
 */
export async function recordFullBalances(
  db: SupabaseClient,
  landlordId: string,
  input: { rentEntryIds: string[]; today: IsoDate },
): Promise<Result<{ payments: { id: string; rentEntryId: string; receiptNumber: string }[]; alreadyPaid: string[] }>> {
  const ids = [...new Set(input.rentEntryIds)];
  if (ids.length === 0) return { ok: false, error: "Choose at least one month to mark paid." };
  const loaded = await loadEntries(db, ids, input.today);
  if ("error" in loaded) return { ok: false, error: SAVE_FAILED };
  if (ids.some((id) => !loaded.byId.has(id))) return { ok: false, error: NOT_FOUND };

  const plan = planBulkPayments(ids.map((id) => ({ id, state: loaded.byId.get(id)!.state })));
  if (plan.payments.length === 0) return { ok: false, error: "Everything selected is already paid." };

  const result = await recordPayments(db, landlordId, {
    items: plan.payments,
    receivedOn: input.today,
    reference: "",
    today: input.today,
  });
  return result.ok ? { ...result, alreadyPaid: plan.alreadyPaid } : result;
}

const VOID_NOTES = {
  undo: "Undone from the payment toast",
  panel: "Voided from the rent detail panel",
} as const;

/**
 * D-11: Undo (within the toast's 10 seconds) and L05-BTN-VOIDPAYMENT both void; nothing deletes.
 * The receipt number stays on the voided row, so it is burnt, never released or reused.
 */
export async function voidPayments(
  db: SupabaseClient,
  landlordId: string,
  paymentIds: string[],
  via: keyof typeof VOID_NOTES,
): Promise<Result<{ voided: string[] }>> {
  if (paymentIds.length === 0) return { ok: false, error: NOT_FOUND };
  const { data, error } = await db
    .from("payment")
    .update({ status: "voided", voided_at: new Date().toISOString() })
    .in("id", paymentIds)
    .eq("status", "recorded")
    .select("id, receipt_number");
  if (error) return { ok: false, error: SAVE_FAILED };
  const voided = data as { id: string; receipt_number: string }[];
  if (voided.length === 0) return { ok: false, error: "That payment was already voided." };

  await audit(
    db,
    voided.map((p) => ({
      landlord_id: landlordId,
      entity_type: "payment",
      entity_id: p.id,
      kind: "payment_voided",
      new_value: { receipt_number: p.receipt_number, status: "voided" },
      note: VOID_NOTES[via],
    })),
  );
  return { ok: true, voided: voided.map((p) => p.receipt_number) };
}

/**
 * L05-BTN-EDIT (D-25): change amount_due while not Paid, never below what was received, and
 * record old and new value on the timeline. The update only applies if the amount is still the
 * one the landlord saw; if the audit row cannot be written the amount is put back.
 */
export async function editAmountDue(
  db: SupabaseClient,
  landlordId: string,
  input: { rentEntryId: string; next: number; today: IsoDate },
): Promise<Result> {
  const loaded = await loadEntries(db, [input.rentEntryId], input.today);
  if ("error" in loaded) return { ok: false, error: SAVE_FAILED };
  const entry = loaded.byId.get(input.rentEntryId);
  if (!entry) return { ok: false, error: NOT_FOUND };

  const problem = validateAmountEdit({ state: entry.state, next: input.next });
  if (problem) return { ok: false, error: problem };

  const { data, error } = await db
    .from("rent_entry")
    .update({ amount_due: input.next })
    .eq("id", entry.id)
    .eq("amount_due", entry.amount_due)
    .select("id");
  if (error) return { ok: false, error: SAVE_FAILED };
  if ((data ?? []).length === 0) return { ok: false, error: "This month changed while you were editing. Close the panel and try again." };

  const auditError = await audit(db, [
    {
      landlord_id: landlordId,
      entity_type: "rent_entry",
      entity_id: entry.id,
      kind: "amount_edit",
      old_value: { amount_due: entry.amount_due },
      new_value: { amount_due: input.next },
    },
  ]);
  if (auditError) {
    await db.from("rent_entry").update({ amount_due: entry.amount_due }).eq("id", entry.id).eq("amount_due", input.next);
    return { ok: false, error: SAVE_FAILED };
  }
  return { ok: true };
}

/**
 * L05-BTN-LOGCALL: "Saves to the timeline as a reminder record with method call" — a `message`
 * row of kind `call` (D-17). It appears in the reminder history but does not change the tone
 * S-01 pre-selects (D-38).
 */
export async function logCall(
  db: SupabaseClient,
  landlordId: string,
  input: { rentEntryId: string; outcome: string; note: string },
): Promise<Result> {
  if (!isCallOutcome(input.outcome)) return { ok: false, error: "Choose how the call went." };
  const { data: entry, error } = await db
    .from("rent_entry")
    .select("id, tenancy_id")
    .eq("id", input.rentEntryId)
    .maybeSingle();
  if (error) return { ok: false, error: SAVE_FAILED };
  if (!entry) return { ok: false, error: NOT_FOUND };

  const { error: insertError } = await db.from("message").insert({
    landlord_id: landlordId,
    kind: "call",
    channel: "call",
    rent_entry_id: entry.id,
    tenancy_id: entry.tenancy_id,
    body: null,
    level: null,
    call_outcome: input.outcome,
    call_note: input.note.trim() || null,
  });
  if (insertError) return { ok: false, error: SAVE_FAILED };
  return { ok: true };
}
