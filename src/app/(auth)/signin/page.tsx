import type { Metadata } from "next";

import { GOOGLE_ERROR_CODE, GOOGLE_ERROR_MESSAGE, SIGN_IN_ERROR_PARAM } from "@/lib/auth/oauth";
import { NEXT_PARAM, sanitizeNextPath } from "@/lib/auth/paths";

import { SignInForm } from "./sign-in-form";

// L-01 · Sign in — route /signin. Public; a signed-in user is redirected by src/proxy.ts.
export const metadata: Metadata = { title: "Sign in · RentRoll" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params[NEXT_PARAM];
  const next = sanitizeNextPath(Array.isArray(raw) ? raw[0] : raw);
  // Only a known code is mapped to wording; the URL never carries message text.
  const googleFailed = params[SIGN_IN_ERROR_PARAM] === GOOGLE_ERROR_CODE;
  return <SignInForm next={next} initialError={googleFailed ? GOOGLE_ERROR_MESSAGE : null} />;
}
