import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

import { botKey, issueStamp } from "./bot-check";
import { createSupabaseTenantRepo } from "./repo";
import { findOwnRequestWith, onlyTenantLink, resolveWith, type ResolvedTenant } from "./resolve";
import { submitReportWith } from "./submit";

// Tenant (token-scoped) server code. Routes under src/app/(tenant) import from here only.
// Every read and the one write go through the token resolution in resolve.ts (D-04, D-30).

export type { OwnRequestView, ResolvedTenant, TenantHeader, TenantRequestView, TenantView } from "./resolve";
export type { SubmitResult } from "@/lib/tenant/report";
export { onlyTenantLink };

const repo = () => createSupabaseTenantRepo(createSupabaseAdminClient());

/** P3.1: a token in, a tenant context or `null` out. Every failure is the same `null` (E1-10). */
export function resolveTenantToken(token: unknown): Promise<ResolvedTenant | null> {
  return resolveWith(repo(), token);
}

/** T-02: the token's own request by number, or `null` for any number that is not its own. */
export function findOwnRequest(resolved: ResolvedTenant, requestNumber: unknown) {
  return findOwnRequestWith(repo(), resolved, requestNumber);
}

/** T-01 render stamp for the invisible bot check. */
export function renderStamp(token: string): string {
  return issueStamp(botKey(), token, Date.now());
}

/** T01-BTN-SUBMIT. */
export function submitTenantReport(token: unknown, form: FormData) {
  return submitReportWith({ repo: repo(), botKey: botKey(), now: () => new Date() }, token, form);
}
