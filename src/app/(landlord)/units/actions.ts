"use server";

import { revalidatePath } from "next/cache";

import { requireLandlord } from "@/server/auth/session";
import { startUpload, type StartedUpload } from "@/server/landlord/units/files";
import {
  addTenancy,
  attachDocuments,
  createUnit,
  deleteUnit,
  regenerateDoorToken,
  updateUnit,
  type AddTenancyInput,
  type Result,
} from "@/server/landlord/units/mutations";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

import type { TenancyDocumentType } from "./_lib/files";
import type { NewUnitInput, TenancyField, UnitField, UnitFields } from "./_lib/forms";

// Server actions for L-08, L-09 and the upload steps of L-09 and L-11. Each one checks the
// session itself (actions are reachable by direct POST) and works through the landlord's
// RLS-scoped client; the service-role client is only handed to the storage helpers.

async function session(path: string) {
  const landlord = await requireLandlord(path);
  return { landlord, db: await createSupabaseServerClient() };
}

/** L08-BTN-ADDUNIT. */
export async function createUnitAction(input: NewUnitInput): Promise<Result<{ unitId: string }, UnitField>> {
  const { landlord, db } = await session("/units");
  const result = await createUnit(db, landlord.landlordId, input);
  if (result.ok) revalidatePath("/units");
  return result;
}

/** L09-BTN-EDITUNIT †. */
export async function updateUnitAction(unitId: string, input: UnitFields): Promise<Result<object, keyof UnitFields>> {
  const { db } = await session(`/units/${unitId}`);
  const result = await updateUnit(db, unitId, input);
  if (result.ok) {
    revalidatePath("/units");
    revalidatePath(`/units/${unitId}`);
  }
  return result;
}

/** L-09 delete (D-39): only a unit with no tenancy or repair history. */
export async function deleteUnitAction(unitId: string): Promise<Result> {
  const { db } = await session(`/units/${unitId}`);
  const result = await deleteUnit(db, createSupabaseAdminClient(), unitId);
  if (result.ok) revalidatePath("/units");
  return result;
}

/** L09-BTN-QR → replace the door code (D-01). */
export async function regenerateDoorTokenAction(unitId: string): Promise<Result> {
  const { landlord, db } = await session(`/units/${unitId}`);
  const result = await regenerateDoorToken(db, landlord.landlordId, unitId);
  if (result.ok) revalidatePath(`/units/${unitId}`);
  return result;
}

/** S-04 step one: a one-time upload URL for one file in the landlord's own folder (D-15). */
export async function startUploadAction(input: {
  type: TenancyDocumentType;
  mime: string;
  size: number;
}): Promise<Result<{ upload: StartedUpload }>> {
  const { landlord } = await session("/units");
  return startUpload(createSupabaseAdminClient(), landlord.landlordId, input);
}

/** L09-FRM-ADDTENANT † save (D-39). */
export async function addTenancyAction(
  unitId: string,
  input: AddTenancyInput,
): Promise<Result<{ tenancyId: string }, TenancyField>> {
  const { landlord, db } = await session(`/units/${unitId}`);
  const result = await addTenancy(db, createSupabaseAdminClient(), landlord.landlordId, unitId, input);
  if (result.ok) {
    revalidatePath("/units");
    revalidatePath(`/units/${unitId}`);
    revalidatePath("/tenants");
  }
  return result;
}

/** L09-TAB-PHOTOS † and L11-SEC-DOCS †: attach finished uploads to a tenancy. */
export async function attachDocumentsAction(input: {
  tenancyId: string;
  unitId: string;
  type: TenancyDocumentType;
  files: { documentId: string; fileName: string; alt: string | null }[];
}): Promise<Result<{ count: number }>> {
  const { landlord, db } = await session(`/tenants/${input.tenancyId}`);
  const result = await attachDocuments(db, createSupabaseAdminClient(), landlord.landlordId, input);
  if (result.ok) {
    revalidatePath(`/units/${input.unitId}`);
    revalidatePath(`/tenants/${input.tenancyId}`);
  }
  return result;
}
