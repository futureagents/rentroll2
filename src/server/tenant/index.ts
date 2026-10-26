import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

import { botKey, issueStamp } from "./bot-check";
import { CONFIRMATION, confirmationKey, issueConfirmation } from "./confirmation";
import { createSupabaseTenantRepo } from "./repo";
import { findConfirmedRequestWith, onlyTenantLink, resolveWith, type ResolvedTenant } from "./resolve";
import { submitReportWith } from "./submit";

// Tenant (token-scoped) server code. Routes under src/app/(tenant) import from here only.
// Every read and the one write go through the token resolution in resolve.ts (D-04, D-30).

export type { OwnRequestView, ResolvedTenant, TenantHeader, TenantRequestView, TenantView } from "./resolve";
import type { SubmitResult } from "@/lib/tenant/report";
export type { SubmitResult };
export { onlyTenantLink };

/** T-02 door confirmation cookie (confirmation.ts): name and life, for the action that sets it. */
export const T02_CONFIRMATION_COOKIE = { name: CONFIRMATION.cookie, maxAgeSeconds: CONFIRMATION.maxAgeMs / 1000 };

const repo = () => createSupabaseTenantRepo(createSupabaseAdminClient());

/** P3.1: a token in, a tenant context or `null` out. Every failure is the same `null` (E1-10). */
export function resolveTenantToken(token: unknown): Promise<ResolvedTenant | null> {
  return resolveWith(repo(), token);
}

/**
 * T-02: the token's own request by number, or `null` for any number that is not its own. Under a
 * door token, only with the confirmation cookie the submit set for that number (D-02).
 */
export function findOwnRequest(token: string, resolved: ResolvedTenant, requestNumber: unknown, confirmation: unknown) {
  return findConfirmedRequestWith({ repo: repo(), confirmationKey, now: Date.now }, token, resolved, requestNumber, confirmation);
}

/** T-01 render stamp for the invisible bot check. */
export function renderStamp(token: string): string {
  return issueStamp(botKey(), token, Date.now());
}

/**
 * T01-BTN-SUBMIT. Returns the client-safe result, and for a door-token report the T-02
 * confirmation the action must set as an HttpOnly cookie (never sent to client code).
 */
export async function submitTenantReport(
  token: unknown,
  form: FormData,
): Promise<{ result: SubmitResult; confirmation: string | null }> {
  let confirmation: string | null = null;
  const result = await submitReportWith(
    {
      repo: repo(),
      botKey: botKey(),
      now: () => new Date(),
      onReported: (kind, requestNumber) => {
        if (kind === "door" && typeof token === "string") {
          confirmation = issueConfirmation(confirmationKey(), token, requestNumber, Date.now());
        }
      },
    },
    token,
    form,
  );
  return { result, confirmation };
}
