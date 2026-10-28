import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CHECK_FIELDS,
  SAVE_FAILED,
  SETTINGS_DEFAULTS,
  parseContacts,
  parseLadderDays,
  parsePayment,
  parseReminders,
  type ContactsField,
  type ContactsInput,
  type LadderDays,
  type LandlordSettings,
  type PaymentField,
  type PaymentInput,
  type RemindersField,
  type RemindersInput,
  type SaveResult,
} from "@/lib/settings";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { verifyLogoUpload } from "./logo";

// L-15 · Settings — the single source for the landlord's settings (D-20). Every screen that needs
// one reads it here, through the signed-in landlord's RLS client, on every request: nothing is
// cached, so a value saved on L-15 is what the next S-01 open, S-02 sheet or P-01 print uses.
//
//   import { getLadderDays } from "@/server/settings";
//   const ladderDays = await getLadderDays(supabase);   // S-01 tone pre-selection (D-41)
//
// Callers check the session first (requireLandlord, or auth.getUser in S-01). Signed out, RLS
// shows no landlord row and the defaults come back with `saved: false`.

const COLUMNS =
  "id, name, email, phone, upi_id, receipt_name, logo_document_id, escalation_default_pct, ladder_days, accountant_email";

interface LandlordRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  upi_id: string | null;
  receipt_name: string | null;
  logo_document_id: string | null;
  escalation_default_pct: number | string | null;
  ladder_days: unknown;
  accountant_email: string | null;
}

/** The signed-in landlord's settings, or the defaults when no row is visible. */
export async function getLandlordSettings(db?: SupabaseClient): Promise<LandlordSettings> {
  const client = db ?? (await createSupabaseServerClient());
  const { data, error } = await client.from("landlord").select(COLUMNS).maybeSingle<LandlordRow>();
  if (error) throw error;
  if (!data) return SETTINGS_DEFAULTS;

  // The schema's check constraint (D-20) makes a malformed ladder impossible. If one ever appears,
  // fail loudly: quietly falling back to the default days is the bug this module exists to prevent.
  const ladderDays = parseLadderDays(data.ladder_days);
  if (!ladderDays) throw new Error("landlord.ladder_days is malformed");

  return {
    saved: true,
    name: data.name,
    email: data.email,
    phone: data.phone,
    upiId: data.upi_id,
    receiptName: data.receipt_name,
    logoDocumentId: data.logo_document_id,
    escalationDefaultPct: data.escalation_default_pct === null ? null : Number(data.escalation_default_pct),
    ladderDays,
    accountantEmail: data.accountant_email,
  };
}

/** L15-TBL-LADDER, for S-01's tone pre-selection (D-41). */
export async function getLadderDays(db?: SupabaseClient): Promise<LadderDays> {
  return (await getLandlordSettings(db)).ladderDays;
}

// ---------------------------------------------------------------------------------------------
// Saves. One per L-15 section, each writing only its own columns through RLS, so saving one
// section can never overwrite another section's unsaved edits or another tab's save.
// ---------------------------------------------------------------------------------------------

async function updateOwnRow(db: SupabaseClient, landlordId: string, values: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await db.from("landlord").update(values).eq("id", landlordId).select("id").maybeSingle();
  return !error && Boolean(data);
}

/** Payment: UPI ID, receipt name, logo (L15-FLD-UPI, L15-FLD-RECEIPTNAME, L15-UPL-LOGO). */
export async function savePayment(
  db: SupabaseClient,
  admin: SupabaseClient,
  landlordId: string,
  input: PaymentInput,
): Promise<SaveResult<PaymentField>> {
  const parsed = parsePayment(input);
  if (!parsed.ok) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.fieldErrors };

  const { data: current, error: readError } = await db
    .from("landlord")
    .select("logo_document_id")
    .eq("id", landlordId)
    .maybeSingle<{ logo_document_id: string | null }>();
  if (readError || !current) return { ok: false, error: SAVE_FAILED };
  const previousLogo = current.logo_document_id;

  const values: Record<string, unknown> = { ...parsed.value };
  let newLogo: string | null = null;

  if (input.logo.action === "replace") {
    const verified = await verifyLogoUpload(db, admin, landlordId, input.logo.documentId, input.logo.fileName);
    if (!verified.ok) return { ok: false, error: CHECK_FIELDS, fieldErrors: { logo: verified.error } };
    const { error } = await db.from("document").insert({
      ...verified.row,
      landlord_id: landlordId,
      type: "logo",
      uploaded_by: "landlord",
      alt_text: `Logo for ${parsed.value.receipt_name ?? "the receipt"}`,
    });
    if (error) return { ok: false, error: SAVE_FAILED };
    newLogo = verified.row.id;
    values.logo_document_id = newLogo;
  } else if (input.logo.action === "remove") {
    values.logo_document_id = null;
  }

  if (!(await updateOwnRow(db, landlordId, values))) {
    if (newLogo) await db.from("document").delete().eq("id", newLogo);
    return { ok: false, error: SAVE_FAILED };
  }

  // D-15: "L15-UPL-LOGO accepts one image, replacing the previous." The old row goes through RLS.
  // Its stored file stays in the bucket: this lane's service-role use is limited to signing the
  // upload and reading it back (cleanup job: Integration requirements in the lane PR).
  if (input.logo.action !== "keep" && previousLogo && previousLogo !== newLogo) {
    await db.from("document").delete().eq("id", previousLogo).eq("type", "logo");
  }
  return { ok: true };
}

/** Reminders: the ladder days and the default escalation (L15-TBL-LADDER, L15-FLD-ESCDEFAULT). */
export async function saveReminders(
  db: SupabaseClient,
  landlordId: string,
  input: RemindersInput,
): Promise<SaveResult<RemindersField>> {
  const parsed = parseReminders(input);
  if (!parsed.ok) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.fieldErrors };
  const ok = await updateOwnRow(db, landlordId, { ...parsed.value, ladder_days: [...parsed.value.ladder_days] });
  return ok ? { ok: true } : { ok: false, error: SAVE_FAILED };
}

/** Contacts: the landlord's name and phone (D-20) and the accountant's email (L15-FLD-CAEMAIL). */
export async function saveContacts(
  db: SupabaseClient,
  landlordId: string,
  input: ContactsInput,
): Promise<SaveResult<ContactsField>> {
  const parsed = parseContacts(input);
  if (!parsed.ok) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.fieldErrors };
  const ok = await updateOwnRow(db, landlordId, parsed.value);
  return ok ? { ok: true } : { ok: false, error: SAVE_FAILED };
}
