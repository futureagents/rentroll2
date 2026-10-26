"use server";

import { revalidatePath } from "next/cache";

import { requireLandlord } from "@/server/auth/session";
import { endTenancy, recordNotice, type Result } from "@/server/landlord/units/mutations";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { kolkataToday } from "../units/_lib/dates";

// Server actions for L-11. Each checks the session itself and uses the RLS-scoped client.

/** L11-BTN-ENDTENANCY (D-05). The caller then routes to L-13 with this tenancy selected. */
export async function endTenancyAction(tenancyId: string, unitId: string, endedOn: string): Promise<Result<object, "endedOn">> {
  const landlord = await requireLandlord(`/tenants/${tenancyId}`);
  const db = await createSupabaseServerClient();
  const result = await endTenancy(db, landlord.landlordId, tenancyId, endedOn, kolkataToday(new Date()));
  if (result.ok) {
    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenancyId}`);
    revalidatePath("/units");
    revalidatePath(`/units/${unitId}`);
  }
  return result;
}

/** L11-BTN-RECORDNOTICE † (D-13). */
export async function recordNoticeAction(
  tenancyId: string,
  unitId: string,
  givenOn: string,
  vacateOn: string,
): Promise<Result<object, "givenOn" | "vacateOn">> {
  const landlord = await requireLandlord(`/tenants/${tenancyId}`);
  const db = await createSupabaseServerClient();
  const result = await recordNotice(db, landlord.landlordId, tenancyId, givenOn, vacateOn);
  if (result.ok) {
    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenancyId}`);
    revalidatePath("/units");
    revalidatePath(`/units/${unitId}`);
  }
  return result;
}
