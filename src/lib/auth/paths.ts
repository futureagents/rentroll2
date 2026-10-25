// L-01 / E4-6 — which paths need a signed-in landlord, and how the "return to the intended
// screen" target is carried and sanitised. Client-safe: used by src/proxy.ts and the sign-in action.

/**
 * Route prefixes that require a signed-in landlord. From the screen files via
 * src/components/shell/nav.ts (L-03…L-14), D-39 (L-14 /documents, L-15 /settings), L-02 (/setup)
 * and D-03 (landlord P-01 at /print/receipt/:paymentId). Tenant routes (/u/*) and the auth routes
 * are public and are not listed.
 */
export const LANDLORD_PATH_PREFIXES: readonly string[] = [
  "/landlord",
  "/rent",
  "/maintenance",
  "/units",
  "/tenants",
  "/agreements",
  "/deposits",
  "/documents",
  "/settings",
  "/setup",
  "/print",
];

/** L-01 routes. A signed-in user hitting one of these is redirected to the app (L-01 ACCESS). */
export const AUTH_ENTRY_PATHS: readonly string[] = ["/signin", "/signup"];

export const SIGN_IN_PATH = "/signin";
/** Query parameter carrying the screen to return to after sign-in (E4-6). */
export const NEXT_PARAM = "next";
/** L-01 LEADS TO: L-02 if no properties exist yet, otherwise L-03. */
export const SETUP_PATH = "/setup";
export const DASHBOARD_PATH = "/landlord";

export function isLandlordPath(pathname: string): boolean {
  return LANDLORD_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Accepts only a same-origin landlord path as the post-sign-in target. Anything else (absolute
 * URLs, protocol-relative `//evil`, backslashes, tenant or auth routes) returns null so the
 * caller falls back to L-02 / L-03. The value must be a landlord path: there is no reason to
 * bounce a landlord to a public page after signing in.
 */
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length > 2048) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\s\\]/.test(value)) return null;
  if (value.includes("://")) return null;
  const pathname = value.split(/[?#]/, 1)[0];
  if (!isLandlordPath(pathname)) return null;
  return value;
}

/** Builds the sign-in URL that remembers where the landlord was going (E4-6). */
export function signInRedirectPath(intended: string): string {
  const next = sanitizeNextPath(intended);
  return next ? `${SIGN_IN_PATH}?${NEXT_PARAM}=${encodeURIComponent(next)}` : SIGN_IN_PATH;
}
