import "server-only";

// S-01 · The only writer of `message` rows in the product (G-1, D-17). Two entry points:
//   recordConfirmedSend — written only when the landlord answers "Did you send it?" → Yes; the
//     composer's state machine reaches it from nowhere else. Private to the composer.
//   recordCall — L05-FRM-LOGCALL's saved call (kind `call`). The one export other lanes may
//     import: it records a call that already happened and cannot send or hand anything off.
// tests/composer/single-send-path.test.ts fails if any other file writes the `message` table, or
// imports anything from this module other than `recordCall`.
import { levelForTone } from "@/components/composer/ladder";
import type { ConfirmSentInput, ConfirmSentResult } from "@/components/composer/types";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { isUuid } from "./load";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The signed-in landlord's id and the rent entry, both read under RLS (D-04), or null. */
async function ownEntry(supabase: Supabase, rentEntryId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Another landlord's entry is invisible under RLS, so nothing is written for it (E4-5).
  const [landlord, entry] = await Promise.all([
    supabase.from("landlord").select("id").maybeSingle(),
    supabase.from("rent_entry").select("id, tenancy_id").eq("id", rentEntryId).maybeSingle(),
  ]);
  if (landlord.error || entry.error || !landlord.data || !entry.data) return null;
  return { landlordId: landlord.data.id as string, entry: entry.data as { id: string; tenancy_id: string } };
}

export async function recordConfirmedSend(input: ConfirmSentInput): Promise<ConfirmSentResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const own = await ownEntry(supabase, input.rentEntryId);
    if (!own) return { ok: false };

    const { error } = await supabase.from("message").insert({
      id: input.sendId,
      landlord_id: own.landlordId,
      kind: "rent_reminder",
      channel: input.channel,
      rent_entry_id: own.entry.id,
      tenancy_id: own.entry.tenancy_id,
      level: levelForTone(input.tone), // the tone actually sent, not the pre-selection (D-41)
      body: input.body,
    });
    // 23505: this send was already recorded (a retried "Yes" after a lost response). The row
    // exists once, so the escalation history (D-41) counts it once.
    return !error || error.code === "23505" ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** L05-FRM-LOGCALL outcomes, as stored in `message.call_outcome`. */
const CALL_OUTCOMES = new Set(["promised_to_pay", "no_answer", "disputed", "other"]);
const MAX_CALL_NOTE = 500;

/**
 * L05-FRM-LOGCALL: record a call the landlord has already made, as a `message` row of kind
 * `call` on the rent entry (D-17). It counts as a contact for the tone pre-selection (D-41), so
 * callers save it once per form submission. Validates its input itself: callers are server
 * functions reachable by direct POST.
 */
export async function recordCall(input: {
  rentEntryId: string;
  outcome: "promised_to_pay" | "no_answer" | "disputed" | "other";
  note: string | null;
}): Promise<{ ok: true } | { ok: false }> {
  const note = typeof input?.note === "string" && input.note.trim() !== "" ? input.note.trim() : null;
  const valid =
    isUuid(input?.rentEntryId) &&
    CALL_OUTCOMES.has(input.outcome) &&
    (input.note === null || typeof input.note === "string") &&
    (note === null || note.length <= MAX_CALL_NOTE);
  if (!valid) return { ok: false };
  try {
    const supabase = await createSupabaseServerClient();
    const own = await ownEntry(supabase, input.rentEntryId);
    if (!own) return { ok: false };

    // message_call_shape: kind `call` ⇔ channel `call`, no body, no level.
    const { error } = await supabase.from("message").insert({
      landlord_id: own.landlordId,
      kind: "call",
      channel: "call",
      rent_entry_id: own.entry.id,
      tenancy_id: own.entry.tenancy_id,
      call_outcome: input.outcome,
      call_note: note,
    });
    return error ? { ok: false } : { ok: true };
  } catch {
    return { ok: false };
  }
}
