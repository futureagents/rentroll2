"use server";

import { redirect } from "next/navigation";

import { NEXT_PARAM, sanitizeNextPath } from "@/lib/auth/paths";
import {
  GOOGLE_ERROR_PATH,
  GOOGLE_FLOW,
  OAUTH_FLOW_PARAM,
  OAUTH_LANDING_PATH,
} from "@/lib/auth/oauth";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * L-01 "Continue with Google". Starts the Supabase OAuth (PKCE) flow; the code verifier is set as
 * a cookie on this response and /auth/callback exchanges the code. The callback URL is built only
 * from APP_BASE_URL (D-03, .env.example), never from the request's Host, so one build serves
 * localhost and the deployed domain. The landlord row is created by the database trigger on the
 * first sign-in (D-20, app.handle_new_user), not here.
 */
export async function continueWithGoogle(formData: FormData): Promise<void> {
  const next = sanitizeNextPath(String(formData.get(NEXT_PARAM) ?? "")) ?? OAUTH_LANDING_PATH;
  const base = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  if (!base) {
    console.error("[auth] Google sign-in: APP_BASE_URL is not set");
    redirect(GOOGLE_ERROR_PATH);
  }

  const callback = new URL(`${base}/auth/callback`);
  callback.searchParams.set(OAUTH_FLOW_PARAM, GOOGLE_FLOW);
  callback.searchParams.set(NEXT_PARAM, next);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
  if (error || !data.url) {
    console.error("[auth] Google sign-in could not start:", error?.code, error?.message);
    redirect(GOOGLE_ERROR_PATH);
  }

  redirect(data.url);
}
