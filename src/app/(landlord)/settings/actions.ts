"use server";

import { revalidatePath } from "next/cache";

import type { SignedUpload } from "@/components/upload/transport";
import type {
  ContactsField,
  ContactsInput,
  PaymentField,
  PaymentInput,
  RemindersField,
  RemindersInput,
  SaveResult,
} from "@/lib/settings";
import { requireLandlord } from "@/server/auth/session";
import { saveContacts, savePayment, saveReminders } from "@/server/settings";
import { startLogoUpload } from "@/server/settings/logo";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

// L-15 server actions, one per section. Each checks the session itself (actions are reachable by
// direct POST) and writes through the landlord's RLS client. The service-role client goes to the
// logo storage helpers only (src/server/settings/logo.ts).

const PATH = "/settings";

async function session() {
  const landlord = await requireLandlord(PATH);
  return { landlord, db: await createSupabaseServerClient() };
}

/** L15-SEC-PAYMENT †: UPI ID, receipt name, logo. */
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

/** S-04 signer for L15-UPL-LOGO: a one-time upload URL in the landlord's own folder (D-15). */
export async function signLogoUploadAction(file: { mime: string; size: number }): Promise<SignedUpload> {
  const { landlord } = await session();
  return startLogoUpload(createSupabaseAdminClient(), landlord.landlordId, file);
}
