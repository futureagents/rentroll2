"use server";

import { redirect } from "next/navigation";

import { DASHBOARD_PATH, NEXT_PARAM, sanitizeNextPath, SETUP_PATH } from "@/lib/auth/paths";
import { INCORRECT_MESSAGE, THROTTLE_MESSAGE } from "@/lib/auth/throttle";
import { hasAnyProperty } from "@/server/auth/session";
import {
  clearFailedAttempts,
  recordFailedAttempt,
  throttleSecondsRemaining,
} from "@/server/auth/throttle";
import { createSupabaseServerClient } from "@/server/supabase/server";

import type { AuthActionState } from "../_components/auth-state";

/** L-01 "Validate both fields are filled" — wording is not given in the spec. */
const FIELDS_REQUIRED_MESSAGE = "Enter your email and password.";

/**
 * L01-BTN-SIGNIN. Validate both fields → throttle (five failures → 30 s) → sign in → on failure
 * one inline error that never says which field is wrong → on success route to the intended screen
 * (E4-6) or to L-02 / L-03.
 */
export async function signIn(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get(NEXT_PARAM) ?? ""));

  if (!email || !password) return { error: FIELDS_REQUIRED_MESSAGE };

  if ((await throttleSecondsRemaining(email)) > 0) return { error: THROTTLE_MESSAGE };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const wait = await recordFailedAttempt(email);
    return { error: wait > 0 ? THROTTLE_MESSAGE : INCORRECT_MESSAGE };
  }

  await clearFailedAttempts(email);

  const destination = next ?? ((await hasAnyProperty()) ? DASHBOARD_PATH : SETUP_PATH);
  redirect(destination);
}
