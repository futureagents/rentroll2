import "server-only";

import { formatDate } from "@/lib/format";
import { nationalDigits, TENANT_CATEGORY_LABEL, TENANT_STATUS_WORD, unitLabel } from "@/lib/tenant/report";

import type { OwnRequestView, TenantHeader, TenantRequestView, TenantView } from "@/lib/tenant/view";

import type { RequestRow, TenantRepo, TenantScope } from "./repo";

export type { OwnRequestView, TenantHeader, TenantRequestView, TenantView };

// P3.1 · The one entry point for tenant routes: a token in, a tenant context or nothing out.
//
// Both token kinds are accepted (D-01): a tenant link resolves to its own tenancy while it is
// active (D-05, E4-2); a door token resolves to whichever tenancy is active on its unit and fails
// when the unit is vacant (T-01 States). Every failure — unknown, altered, ended, settled, vacant,
// malformed, a database fault — is the same `null`, and routes render E1-10 for it.
//
// `view` is the only part a page may hand to a component. It is built field by field from the
// D-30 set; `scope` stays on the server to scope later queries.

export interface ResolvedTenant {
  scope: TenantScope;
  view: TenantView;
}

/** D-01: 20 random bytes as 40 lowercase hex characters (app.new_token). */
const TOKEN_FORMAT = /^[0-9a-f]{40}$/;
/** D-12: R- and at least four digits. */
const REQUEST_NUMBER_FORMAT = /^R-\d{4,9}$/;

/** India has one offset and no daylight saving; a timestamp's Indian calendar date. */
const IST_OFFSET_MS = 330 * 60_000;
function indianDate(timestamp: string): string {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) return "";
  return formatDate(new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10));
}

function scopeOf(scope: TenantScope): TenantScope {
  return { landlordId: scope.landlordId, unitId: scope.unitId, tenancyId: scope.tenancyId };
}

function headerOf(hit: { unitNumber: string; propertyName: string; landlordName: string; landlordPhone: string | null }): TenantHeader {
  return {
    unitLabel: unitLabel(hit.unitNumber),
    propertyName: hit.propertyName,
    landlordName: hit.landlordName,
    landlordPhone: hit.landlordPhone,
  };
}

function requestView(row: RequestRow): TenantRequestView {
  return {
    requestNumber: row.requestNumber,
    category: TENANT_CATEGORY_LABEL[row.category] ?? "",
    reportedOn: indianDate(row.createdAt),
    status: TENANT_STATUS_WORD[row.status] ?? "",
  };
}

export async function resolveWith(repo: TenantRepo, token: unknown): Promise<ResolvedTenant | null> {
  if (typeof token !== "string" || !TOKEN_FORMAT.test(token)) return null;
  try {
    // Both lookups always run, so every token costs the same queries whatever it turns out to be.
    const [link, door] = await Promise.all([repo.findTenantLink(token), repo.findDoor(token)]);
    if (link && door) return null; // two random 160-bit tokens cannot collide; refuse rather than guess
    if (link) {
      const requests = await repo.listRequests(link.scope);
      return {
        scope: scopeOf(link.scope),
        view: {
          kind: "tenant",
          header: headerOf(link),
          prefill: { name: link.name, phone: nationalDigits(link.phone) ?? "" },
          // Newest first; the query orders too, the page should not depend on it.
          requests: [...requests].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(requestView),
        },
      };
    }
    if (door) {
      // D-02: the door token reaches T-01/T-02 only; no pre-fill, no requests, nothing else read.
      return { scope: scopeOf(door.scope), view: { kind: "door", header: headerOf(door) } };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * T-02: one request of the token's own tenancy, by its number. Any number that is not this
 * tenancy's (another landlord's, another unit's, the previous tenant's) is the same `null` (E4-1).
 */
export async function findOwnRequestWith(
  repo: TenantRepo,
  resolved: ResolvedTenant,
  requestNumber: unknown,
): Promise<OwnRequestView | null> {
  if (typeof requestNumber !== "string" || !REQUEST_NUMBER_FORMAT.test(requestNumber)) return null;
  try {
    const row = await repo.findRequest(resolved.scope, requestNumber);
    if (!row || row.requestNumber !== requestNumber) return null;
    return { ...requestView(row), photoCount: row.photoCount };
  } catch {
    return null;
  }
}

/**
 * E4-8 (D-02): T-03, T-04, T-05 and the tenant P-01 route accept a tenant link only. Every one of
 * those pages must pass its resolution through this and render E1-10 for `null`.
 */
export function onlyTenantLink(resolved: ResolvedTenant | null): ResolvedTenant | null {
  return resolved?.view.kind === "tenant" ? resolved : null;
}
