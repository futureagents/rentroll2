import "server-only";

import { redirect } from "next/navigation";

import { signInRedirectPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * The signed-in landlord, read through the request's Supabase session and the `landlord` row
 * RLS lets that session see (D-04, D-20). Null when signed out or when the auth user has no
 * landlord row yet (the sign-up trigger creates it; this should not happen in practice).
 */
export interface CurrentLandlord {
  landlordId: string;
  authUserId: string;
  name: string;
  email: string;
}

export async function getCurrentLandlord(): Promise<CurrentLandlord | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: landlord } = await supabase
    .from("landlord")
    .select("id, auth_user_id, name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!landlord) return null;

  return {
    landlordId: landlord.id,
    authUserId: landlord.auth_user_id,
    name: landlord.name,
    email: landlord.email,
  };
}

/**
 * For landlord server components and actions: the current landlord, or a redirect to L-01 that
 * remembers the intended screen (E4-6). `intendedPath` is the page's own route so the landlord
 * comes back to it after signing in.
 */
export async function requireLandlord(intendedPath: string): Promise<CurrentLandlord> {
  const landlord = await getCurrentLandlord();
  if (!landlord) redirect(signInRedirectPath(intendedPath));
  return landlord;
}

/** L-01 LEADS TO: "L-02 if no properties exist yet, otherwise L-03". */
export async function hasAnyProperty(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("property")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}
