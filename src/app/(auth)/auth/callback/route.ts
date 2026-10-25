import { NextResponse, type NextRequest } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

// Exchanges the PKCE code from a Supabase Auth email link for a session, then continues to the
// step the link was for. Used by the L-01 password reset (/reset/new). Only that step or a landlord
// path may be the target; anything else falls back to /reset/new.
const RESET_NEW_PATH = "/reset/new";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
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
