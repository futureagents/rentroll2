"use server";

import { redirect } from "next/navigation";

import { isPasswordLongEnough, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { SETUP_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

import type { AuthActionState } from "../_components/auth-state";

const FIELDS_REQUIRED_MESSAGE = "Enter your name, email and password.";
const PASSWORD_SHORT_MESSAGE = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
/** Shown when confirmations are on (hosted projects); locally the account is live at once. */
const CONFIRM_MESSAGE = "Check your email for a confirmation link, then sign in.";
const COULD_NOT_CREATE_MESSAGE =
  "Could not create the account. If you already have one, sign in or reset your password.";

/**
 * /signup (L-01). D-20: sign-up collects name, email and password. The name is carried in the
 * auth user's metadata; the `landlord` row is created by the database trigger (D-20).
 * A new account has no property, so success leads to L-02 (L-01 LEADS TO).
 */
export async function signUp(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) return { error: FIELDS_REQUIRED_MESSAGE };
  if (!isPasswordLongEnough(password)) return { error: PASSWORD_SHORT_MESSAGE };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { error: COULD_NOT_CREATE_MESSAGE };

  // With email confirmations on there is no session yet.
  if (!data.session) return { notice: CONFIRM_MESSAGE };

  redirect(SETUP_PATH);
}
