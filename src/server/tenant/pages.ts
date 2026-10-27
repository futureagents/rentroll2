import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatDate, formatMonth } from "@/lib/format";
import { TENANT_CATEGORY_LABEL, TENANT_STATUS_WORD, type Category, type RequestStatus } from "@/lib/tenant/report";
import type { TenantHeader } from "@/lib/tenant/view";

import { SELECT } from "./columns";
import { check, one, str, type TenantScope } from "./repo";
import { indianDate, onlyTenantLink, type ResolvedTenant } from "./resolve";

// P6.3 · The data behind T-03, T-04 and T-05, for a resolved tenant link only (E4-8, D-02).
//
// Each page view is built field by field from D-30 columns (SELECT in columns.ts), every query
// is filtered by the resolved landlord and tenancy, and nothing in a view is an id, a code, a rent
// figure or a cost. The only money is T-05's own recorded payment amounts (D-26). Any failure is
// `null`, which the route renders as E1-10.

/** T03-CHP-STATUS words (D-30): New → Received, the rest as written, plus Reopened. */
export type TenantStatusWord = "Received" | "Assigned" | "In progress" | "Done" | "Reopened";

/** One T03-TML-ITEM line: "Reported" on "03 Feb 2026". */
export interface ReportHistoryLine {
  word: "Reported" | TenantStatusWord;
  /** DD MMM YYYY, Indian calendar date. Never a time. */
  on: string;
}

export interface MyReportView {
  requestNumber: string;
  category: string;
  reportedOn: string;
  status: TenantStatusWord;
  /** The latest landlord-sent `tenant_update`, verbatim (D-17); null when none was sent. */
  latestUpdate: string | null;
  /** Oldest first, starting with "Reported". */
  history: ReportHistoryLine[];
}

export interface MyReportsView {
  header: TenantHeader;
  /** Newest first. */
  reports: MyReportView[];
}

export interface MyUnitView {
  header: TenantHeader;
  /** The current agreement's dates (DD MMM YYYY); null when the landlord has recorded none. */
  agreement: { startsOn: string; endsOn: string } | null;
}

export interface MyReceiptView {
  /** "October 2026". */
  month: string;
  /** Whole rupees (D-19): the tenant's own recorded payment (D-26). */
  amount: number;
  receiptNumber: string;
}

export interface MyReceiptsView {
  header: TenantHeader;
  /** Newest month first. */
  receipts: MyReceiptView[];
}

interface OwnRequest {
  id: string;
  requestNumber: string;
  category: Category;
  status: RequestStatus;
  createdAt: string;
}

interface StatusChange {
  status: RequestStatus;
  reopened: boolean;
  createdAt: string;
}

export interface TenantPagesRepo {
  listRequests(scope: TenantScope): Promise<OwnRequest[]>;
  /** `status_change` rows of one request already scoped to the tenancy, oldest first. */
  listStatusChanges(scope: TenantScope, requestId: string): Promise<StatusChange[]>;
  findLatestUpdate(scope: TenantScope, requestId: string): Promise<string | null>;
  listAgreements(scope: TenantScope): Promise<{ startsOn: string; endsOn: string }[]>;
  listReceipts(scope: TenantScope): Promise<{ amount: number; receiptNumber: string; month: string }[]>;
}

const rows = (data: unknown): Record<string, unknown>[] =>
  (Array.isArray(data) ? (data as unknown[]) : []).flatMap((row) => {
    const record = one(row);
    return record ? [record] : [];
  });

const STATUSES: readonly string[] = ["new", "assigned", "in_progress", "done"];
const isStatus = (value: unknown): value is RequestStatus => typeof value === "string" && STATUSES.includes(value);

export function createSupabaseTenantPagesRepo(client: SupabaseClient): TenantPagesRepo {
  return {
    async listRequests(scope) {
      const { data } = check(
        "my reports",
        await client
          .from("request")
          .select(SELECT.ownRequest)
          .eq("landlord_id", scope.landlordId)
          .eq("tenancy_id", scope.tenancyId)
          .order("created_at", { ascending: false }),
      );
      return rows(data).flatMap((row) =>
        str(row.id) && isStatus(row.status)
          ? [
              {
                id: str(row.id),
                requestNumber: str(row.request_number),
                category: str(row.category) as Category,
                status: row.status,
                createdAt: str(row.created_at),
              },
            ]
          : [],
      );
    },

    async listStatusChanges(scope, requestId) {
      const { data } = check(
        "report history",
        await client
          .from("audit_event")
          .select(SELECT.statusChanges)
          .eq("landlord_id", scope.landlordId)
          .eq("entity_type", "request")
          .eq("entity_id", requestId)
          .eq("kind", "status_change") // D-30: the only kind tenant code reads
          .order("created_at", { ascending: true }),
      );
      // new_value is { status, reopened? } (src/app/(landlord)/maintenance/actions.ts statusAudits).
      return rows(data).flatMap((row) => {
        const next = one(row.new_value);
        if (!next || !isStatus(next.status)) return [];
        return [{ status: next.status, reopened: next.reopened === true, createdAt: str(row.created_at) }];
      });
    },

    async findLatestUpdate(scope, requestId) {
      const { data } = check(
        "latest update",
        await client
          .from("message")
          .select(SELECT.latestUpdate)
          .eq("landlord_id", scope.landlordId)
          .eq("request_id", requestId)
          .eq("kind", "tenant_update") // D-17: never a vendor dispatch, note or rent message
          .order("confirmed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
      const body = str(one(data)?.body).trim();
      return body || null;
    },

    async listAgreements(scope) {
      const { data } = check(
        "agreement dates",
        await client
          .from("agreement")
          .select(SELECT.agreements)
          .eq("landlord_id", scope.landlordId)
          .eq("tenancy_id", scope.tenancyId)
          .order("starts_on", { ascending: true }),
      );
      return rows(data).flatMap((row) =>
        str(row.starts_on) && str(row.ends_on) ? [{ startsOn: str(row.starts_on), endsOn: str(row.ends_on) }] : [],
      );
    },

    async listReceipts(scope) {
      const { data } = check(
        "receipts",
        await client
          .from("payment")
          .select(SELECT.receipts)
          .eq("landlord_id", scope.landlordId)
          .eq("tenancy_id", scope.tenancyId)
          .eq("status", "recorded") // D-26: voided payments never reach the tenant
          .order("received_on", { ascending: false }),
      );
      return rows(data).flatMap((row) => {
        const month = str(one(row.rent_entry)?.month);
        const amount = row.amount;
        if (!month || !str(row.receipt_number) || typeof amount !== "number" || !Number.isInteger(amount)) return [];
        return [{ amount, receiptNumber: str(row.receipt_number), month }];
      });
    },
  };
}

/** India has one offset and no daylight saving: today's Indian calendar date as YYYY-MM-DD. */
function indianToday(now: number): string {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}

/** D-08: a tenancy's agreements never overlap. Current = the one covering today, else the latest begun, else the next. */
export function currentAgreement<T extends { startsOn: string; endsOn: string }>(agreements: T[], today: string): T | null {
  const sorted = [...agreements].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return (
    sorted.find((a) => a.startsOn <= today && today <= a.endsOn) ??
    sorted.filter((a) => a.startsOn <= today).at(-1) ??
    sorted[0] ??
    null
  );
}

function historyOf(request: OwnRequest, changes: StatusChange[]): { status: TenantStatusWord; history: ReportHistoryLine[] } {
  const history: ReportHistoryLine[] = [{ word: "Reported", on: indianDate(request.createdAt) }];
  for (const change of changes) {
    const word = (change.reopened ? "Reopened" : TENANT_STATUS_WORD[change.status]) as TenantStatusWord;
    history.push({ word, on: indianDate(change.createdAt) });
  }
  // D-30: a reopened request shows "Reopened" as its chip until its status moves on.
  const last = changes.at(-1);
  const status = last?.reopened && last.status === request.status ? "Reopened" : TENANT_STATUS_WORD[request.status];
  return { status: status as TenantStatusWord, history };
}

/** T-03. Every request of the token's own tenancy (D-29), each with its history and latest update. */
export async function myReportsWith(repo: TenantPagesRepo, resolved: ResolvedTenant | null): Promise<MyReportsView | null> {
  const own = onlyTenantLink(resolved);
  if (!own) return null;
  try {
    const requests = await repo.listRequests(own.scope);
    const reports = await Promise.all(
      [...requests]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(async (request): Promise<MyReportView> => {
          const [changes, latestUpdate] = await Promise.all([
            repo.listStatusChanges(own.scope, request.id),
            repo.findLatestUpdate(own.scope, request.id),
          ]);
          return {
            requestNumber: request.requestNumber,
            category: TENANT_CATEGORY_LABEL[request.category] ?? "",
            reportedOn: indianDate(request.createdAt),
            latestUpdate,
            ...historyOf(request, changes),
          };
        }),
    );
    return { header: own.view.header, reports };
  } catch {
    return null;
  }
}

/** T-04. Unit, property, landlord and the current agreement's dates. No rent (T04-SEC-UNIT). */
export async function myUnitWith(
  repo: TenantPagesRepo,
  resolved: ResolvedTenant | null,
  now: () => number = Date.now,
): Promise<MyUnitView | null> {
  const own = onlyTenantLink(resolved);
  if (!own) return null;
  try {
    const agreement = currentAgreement(await repo.listAgreements(own.scope), indianToday(now()));
    return {
      header: own.view.header,
      agreement: agreement ? { startsOn: formatDate(agreement.startsOn), endsOn: formatDate(agreement.endsOn) } : null,
    };
  } catch {
    return null;
  }
}

/** T-05. The tenancy's recorded payments, newest month first (D-26). */
export async function myReceiptsWith(repo: TenantPagesRepo, resolved: ResolvedTenant | null): Promise<MyReceiptsView | null> {
  const own = onlyTenantLink(resolved);
  if (!own) return null;
  try {
    const receipts = (await repo.listReceipts(own.scope))
      .sort((a, b) => b.month.localeCompare(a.month) || b.receiptNumber.localeCompare(a.receiptNumber))
      .map((r) => ({ month: formatMonth(r.month), amount: r.amount, receiptNumber: r.receiptNumber }));
    return { header: own.view.header, receipts };
  } catch {
    return null;
  }
}
