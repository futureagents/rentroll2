import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  DASHBOARD_PATH,
  isAuthEntryPath,
  isLandlordPath,
  signInRedirectPath,
} from "@/lib/auth/paths";
import { publicEnv } from "@/lib/env";

/**
 * Runs before every landlord and auth request (Next 16 `proxy`, the renamed middleware).
 *
 * 1. Refreshes the Supabase session cookies so server components see a live session.
 * 2. E4-6: a signed-out request to any landlord route is redirected to L-01 with the intended
 *    screen in `?next=`, so sign-in can return there.
 * 3. L-01 ACCESS: a signed-in user hitting /signin or /signup is redirected to L-03.
 *
 * Tenant routes (/u/*) are excluded by the matcher: they are public bearer-token pages and never
 * depend on a landlord session (D-03, D-04).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseAnonKey } = publicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the token with Supabase Auth; never trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isLandlordPath(pathname)) {
    const url = request.nextUrl.clone();
    const target = new URL(signInRedirectPath(pathname + search), url.origin);
    url.pathname = target.pathname;
    url.search = target.search;
    return NextResponse.redirect(url);
  }

  if (user && isAuthEntryPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = DASHBOARD_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except tenant routes, Next internals, and static assets.
  matcher: ["/((?!u/|_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
