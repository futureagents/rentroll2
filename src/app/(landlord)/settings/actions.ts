"use server";

import { revalidatePath } from "next/cache";

import type { SignedUpload } from "@/components/upload/transport";
import { UPLOAD_MESSAGES } from "@/components/upload/limits";
import {
  IMAGE_KINDS,
  type ContactsField,
  type ContactsInput,
  type ImageKind,
  type PaymentField,
  type PaymentInput,
  type RemindersField,
  type RemindersInput,
  type SaveResult,
} from "@/lib/settings";
import { requireLandlord } from "@/server/auth/session";
import { saveContacts, savePayment, saveReminders } from "@/server/settings";
import { startImageUpload } from "@/server/settings/images";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

// L-15 server actions, one per section. Each checks the session itself (actions are reachable by
// direct POST) and writes through the landlord's RLS client. The service-role client goes to the
// logo and signature storage helpers only (src/server/settings/images.ts).

const PATH = "/settings";

async function session() {
  const landlord = await requireLandlord(PATH);
  return { landlord, db: await createSupabaseServerClient() };
}

/** L15-SEC-PAYMENT †: UPI ID, receipt name, logo, signature (D-56). */
export async function savePaymentAction(input: PaymentInput): Promise<SaveResult<PaymentField>> {
  const { landlord, db } = await session();
  const result = await savePayment(db, createSupabaseAdminClient(), landlord.landlordId, input);
  if (result.ok) revalidatePath(PATH);
  return result;
}

/** L15-SEC-REMINDERS †: ladder days and the default escalation. */
export async function saveRemindersAction(input: RemindersInput): Promise<SaveResult<RemindersField>> {
  const { landlord, db } = await session();
  const result = await saveReminders(db, landlord.landlordId, input);
  if (result.ok) revalidatePath(PATH);
  return result;
}

/** L15-SEC-CONTACTS †: name, phone, accountant's email. */
export async function saveContactsAction(input: ContactsInput): Promise<SaveResult<ContactsField>> {
  const { landlord, db } = await session();
  const result = await saveContacts(db, landlord.landlordId, input);
  if (result.ok) revalidatePath(PATH);
  return result;
}

/** S-04 signer for L15-UPL-LOGO and L15-UPL-SIGNATURE †: a one-time upload URL in the landlord's own folder (D-15, D-56). */
export async function signImageUploadAction(kind: ImageKind, file: { mime: string; size: number }): Promise<SignedUpload> {
  const { landlord } = await session();
  if (!IMAGE_KINDS.includes(kind)) return { ok: false, error: UPLOAD_MESSAGES.notSupported }; // reachable by direct POST
  return startImageUpload(createSupabaseAdminClient(), landlord.landlordId, kind, file);
}
