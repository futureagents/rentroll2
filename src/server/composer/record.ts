import "server-only";

// S-01 · The only writer of sent-message rows in the product (G-1, D-17). A row is written only
// when the landlord answers "Did you send it?" → Yes; the composer's state machine reaches this
// call from nowhere else. tests/composer/single-send-path.test.ts fails if any other file writes
// the `message` table or imports this module.
import { levelForTone } from "@/components/composer/ladder";
import type { ConfirmSentInput, ConfirmSentResult } from "@/components/composer/types";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function recordConfirmedSend(input: ConfirmSentInput): Promise<ConfirmSentResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    // Both reads run under RLS: another landlord's entry is invisible, so nothing is written.
    const [landlord, entry] = await Promise.all([
      supabase.from("landlord").select("id").maybeSingle(),
      supabase.from("rent_entry").select("id, tenancy_id").eq("id", input.rentEntryId).maybeSingle(),
    ]);
    if (landlord.error || entry.error || !landlord.data || !entry.data) return { ok: false };

    const { error } = await supabase.from("message").insert({
      id: input.sendId,
      landlord_id: landlord.data.id,
      kind: "rent_reminder",
      channel: input.channel,
      rent_entry_id: entry.data.id,
      tenancy_id: entry.data.tenancy_id,
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
