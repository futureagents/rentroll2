"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/server/supabase/server";

import { SIGN_IN_HREF } from "./nav";

// D-39: the sidebar "account" item is a menu with the landlord's email and "Sign out".
// Sign-out ends the Supabase session and returns to L-01. L-01 owns sign-in; this is the
// only auth call the shell makes.
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(SIGN_IN_HREF);
}
