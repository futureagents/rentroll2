"use server";

import { redirect } from "next/navigation";

import { isPasswordLongEnough, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { DASHBOARD_PATH } from "@/lib/auth/paths";
import { appBaseUrl } from "@/server/auth/base-url";
import { createSupabaseServerClient } from "@/server/supabase/server";

import type { AuthActionState } from "../_components/auth-state";

/** L-01: "Sending a reset always shows the same confirmation whether or not the email exists." */
const RESET_SENT_MESSAGE =
  "If an account exists for that email, we have sent a link to reset the password. It is valid for one hour.";
const EMAIL_REQUIRED_MESSAGE = "Enter your email.";
const PASSWORD_SHORT_MESSAGE = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
const COULD_NOT_SET_MESSAGE =
  "Could not set the new password. The link may have expired — request a new one from Forgot password.";

/** /reset (L01-LNK-RESET). Always the same confirmation. */
export async function requestReset(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: EMAIL_REQUIRED_MESSAGE };

  const supabase = await createSupabaseServerClient();
  const redirectTo = `${await appBaseUrl()}/auth/callback?next=${encodeURIComponent("/reset/new")}`;
  // Errors (unknown email, rate limit) are deliberately not surfaced: same confirmation always.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return { notice: RESET_SENT_MESSAGE };
}

/** /reset/new — the set-new-password step, reached from the email link via /auth/callback. */
export async function setNewPassword(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  if (!isPasswordLongEnough(password)) return { error: PASSWORD_SHORT_MESSAGE };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: COULD_NOT_SET_MESSAGE };

  redirect(DASHBOARD_PATH);
}
