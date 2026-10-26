"use server";

import { cookies } from "next/headers";

import type { SubmitResult } from "@/lib/tenant/report";
import { submitTenantReport, T02_CONFIRMATION_COOKIE } from "@/server/tenant";

/**
 * T01-BTN-SUBMIT. A public POST endpoint like every server action: the token is re-resolved on
 * the server, nothing else in the form identifies anything, and only the request number (or a
 * message) comes back (src/server/tenant/submit.ts). A door-token report also gets the T-02
 * confirmation cookie, so T-02 can show that one request and no other (D-02).
 */
export async function submitReport(token: string, form: FormData): Promise<SubmitResult> {
  const { result, confirmation } = await submitTenantReport(token, form);
  if (confirmation) {
    (await cookies()).set(T02_CONFIRMATION_COOKIE.name, confirmation, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: `/u/${token}/reported`,
      maxAge: T02_CONFIRMATION_COOKIE.maxAgeSeconds,
    });
  }
  return result;
}
