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
  type ImageChange,
  type ImageKind,
} from "@/lib/settings";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { verifyImageUpload } from "./images";

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
  "id, name, email, phone, upi_id, receipt_name, logo_document_id, signature_document_id, escalation_default_pct, ladder_days, accountant_email";

interface LandlordRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  upi_id: string | null;
  receipt_name: string | null;
  logo_document_id: string | null;
  signature_document_id: string | null;
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
    signatureDocumentId: data.signature_document_id,
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

const KEEP: ImageChange = { action: "keep" };
const IMAGE_COLUMN: Record<ImageKind, "logo_document_id" | "signature_document_id"> = {
  logo: "logo_document_id",
  signature: "signature_document_id",
};

/**
 * Payment: UPI ID, receipt name, logo and signature (L15-FLD-UPI, L15-FLD-RECEIPTNAME,
 * L15-UPL-LOGO, L15-UPL-SIGNATURE †; D-15, D-56). Each image is replaced or removed on its own.
 */
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
    .select("logo_document_id, signature_document_id")
    .eq("id", landlordId)
    .maybeSingle<{ logo_document_id: string | null; signature_document_id: string | null }>();
  if (readError || !current) return { ok: false, error: SAVE_FAILED };

  const values: Record<string, unknown> = { ...parsed.value };
  const owner = parsed.value.receipt_name ?? "the receipt";
  const altText: Record<ImageKind, string> = { logo: `Logo for ${owner}`, signature: `Signature of ${owner}` };
  const inserted: string[] = [];
  const discard = () => (inserted.length ? db.from("document").delete().in("id", inserted) : Promise.resolve());

  // A direct POST may leave an image out; that image is kept.
  const changes: Record<ImageKind, ImageChange> = { logo: input.logo ?? KEEP, signature: input.signature ?? KEEP };
  for (const kind of ["logo", "signature"] as const) {
    const change = changes[kind];
    if (change.action === "remove") values[IMAGE_COLUMN[kind]] = null;
    if (change.action !== "replace") continue;
    const verified = await verifyImageUpload(db, admin, landlordId, kind, change.documentId, change.fileName);
    if (!verified.ok) {
      await discard();
      return { ok: false, error: CHECK_FIELDS, fieldErrors: { [kind]: verified.error } };
    }
    const { error } = await db.from("document").insert({
      ...verified.row,
      landlord_id: landlordId,
      type: kind,
      uploaded_by: "landlord",
      alt_text: altText[kind],
    });
    if (error) {
      await discard();
      return { ok: false, error: SAVE_FAILED };
    }
    inserted.push(verified.row.id);
    values[IMAGE_COLUMN[kind]] = verified.row.id;
  }

  if (!(await updateOwnRow(db, landlordId, values))) {
    await discard();
    return { ok: false, error: SAVE_FAILED };
  }

  // D-15 / D-56: each accepts one image, replacing the previous. The old row goes through RLS.
  // Its stored file stays in the bucket: this lane's service-role use is limited to signing the
  // upload and reading it back (the cleanup job is parked in decisions §9).
  for (const kind of ["logo", "signature"] as const) {
    const previous = current[IMAGE_COLUMN[kind]];
    if (changes[kind].action !== "keep" && previous && previous !== values[IMAGE_COLUMN[kind]]) {
      await db.from("document").delete().eq("id", previous).eq("type", kind);
    }
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
