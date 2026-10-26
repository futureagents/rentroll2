import { NextResponse, type NextRequest } from "next/server";

import {
  GOOGLE_ERROR_PATH,
  GOOGLE_FLOW,
  OAUTH_FLOW_PARAM,
  OAUTH_LANDING_PATH,
} from "@/lib/auth/oauth";
import { sanitizeNextPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

// Exchanges the PKCE code from Supabase Auth for a session, then continues to the step the code
// was for. Two flows:
// - Google sign-in (`flow=google`): on to the E4-6 `next` or /rent; any failure goes to /signin
//   with the safe message, and the real Supabase error is logged here, never shown or put in a URL.
// - L-01 password reset email link: on to /reset/new (or a landlord path); failure → /reset/new.
const RESET_NEW_PATH = "/reset/new";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (searchParams.get(OAUTH_FLOW_PARAM) === GOOGLE_FLOW) {
    const next = sanitizeNextPath(searchParams.get("next")) ?? OAUTH_LANDING_PATH;
    const failed = (...detail: unknown[]) => {
      console.error("[auth/callback] Google sign-in failed:", ...detail);
      return NextResponse.redirect(new URL(GOOGLE_ERROR_PATH, origin));
    };

    // Google or Supabase refused (cancelled consent, provider error): no code, an error instead.
    if (!code) return failed(searchParams.get("error"), searchParams.get("error_description"));

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failed(error.code, error.status, error.message);
    return NextResponse.redirect(new URL(next, origin));
  }

  const requested = searchParams.get("next");
  const next =
    requested === RESET_NEW_PATH ? RESET_NEW_PATH : (sanitizeNextPath(requested) ?? RESET_NEW_PATH);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  // No code or an expired one: /reset/new explains and offers a new link.
  return NextResponse.redirect(new URL(RESET_NEW_PATH, origin));
}
