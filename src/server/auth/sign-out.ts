"use server";

import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Sign out (D-39: the sidebar account menu's "Sign out"). Wired by the shell lane; exported here
 * so every lane calls one action. Ends the session and returns to L-01.
 */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(SIGN_IN_PATH);
}
