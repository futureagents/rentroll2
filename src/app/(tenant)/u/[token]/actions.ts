"use server";

import type { SubmitResult } from "@/lib/tenant/report";
import { submitTenantReport } from "@/server/tenant";

/**
 * T01-BTN-SUBMIT. A public POST endpoint like every server action: the token is re-resolved on
 * the server, nothing else in the form identifies anything, and only the request number (or a
 * message) comes back (src/server/tenant/submit.ts).
 */
export async function submitReport(token: string, form: FormData): Promise<SubmitResult> {
  return submitTenantReport(token, form);
}
