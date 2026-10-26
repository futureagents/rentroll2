// E4-4 (restated by D-26): the data behind any tenant page contains no rent due, no balance, no
// cost, no other unit, no other tenant. The resolver output is an allow-list built field by field,
// so a repository that hands back whole rows still cannot leak them.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TENANT_COLUMNS } from "../../src/server/tenant/columns";
import { findOwnRequestWith, resolveWith } from "../../src/server/tenant/resolve";
import { fakeRepo, SENTINELS, T } from "./fixtures";

/** Every key at every depth, as dotted paths; array items share one path. */
function shape(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => shape(item, `${prefix}[]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [path, ...shape(inner, path)];
    });
  }
  return [];
}
const unique = (paths: string[]) => [...new Set(paths)].sort();

const HEADER = ["header", "header.landlordName", "header.landlordPhone", "header.propertyName", "header.unitLabel"];

function expectNoSentinel(value: unknown) {
  const json = JSON.stringify(value);
  for (const [name, sentinel] of Object.entries(SENTINELS)) {
    expect(json, `leaked ${name}`).not.toContain(String(sentinel));
  }
  // Internal ids never leave the server either (tenant-routes rules).
  for (const id of ["L-A", "L-B", "U-A-2A", "TN-A-active", "RQ-1"]) expect(json).not.toContain(`"${id}"`);
}

describe("E4-4: the tenant view is an exact allow-list", () => {
  it("tenant link: header, pre-fill and own requests, nothing else", async () => {
    const resolved = (await resolveWith(fakeRepo(), T.aActive))!;
    expect(unique(shape(resolved.view))).toEqual(
      unique([
        "kind",
        ...HEADER,
        "prefill",
        "prefill.name",
        "prefill.phone",
        "requests",
        "requests[].category",
        "requests[].reportedOn",
        "requests[].requestNumber",
        "requests[].status",
      ]),
    );
    expectNoSentinel(resolved.view);
  });

  it("door token: the header only", async () => {
    const resolved = (await resolveWith(fakeRepo(), T.aDoorOccupied))!;
    expect(unique(shape(resolved.view))).toEqual(unique(["kind", ...HEADER]));
    expectNoSentinel(resolved.view);
    // D-02: the tenant's name and phone are not shown to whoever scanned the sticker.
    expect(JSON.stringify(resolved.view)).not.toContain("Priya");
    expect(JSON.stringify(resolved.view)).not.toContain("9000000303");
  });

  it("T-02 own request: number, category, date, status and photo count only", async () => {
    const repo = fakeRepo();
    const resolved = (await resolveWith(repo, T.aActive))!;
    const own = await findOwnRequestWith(repo, resolved, "R-0001");
    expect(unique(shape(own))).toEqual(unique(["category", "photoCount", "reportedOn", "requestNumber", "status"]));
    expectNoSentinel(own);
  });

  it("never shows urgency, so a reclassification is invisible to the tenant (D-21, D-30)", async () => {
    const repo = fakeRepo();
    const resolved = (await resolveWith(repo, T.aActive))!;
    const own = await findOwnRequestWith(repo, resolved, "R-0001");
    expect(JSON.stringify([resolved.view, own]).toLowerCase()).not.toMatch(/urgen|suggest/);
  });

  it("contains no other tenancy's or other unit's requests", async () => {
    const resolved = (await resolveWith(fakeRepo(), T.aActive))!;
    if (resolved.view.kind !== "tenant") throw new Error("expected a tenant link");
    expect(resolved.view.requests.map((r) => r.requestNumber).sort()).toEqual(["R-0001", "R-0003"]);
  });
});

describe("TENANT_COLUMNS is D-30, the complete tenant-readable column set", () => {
  // Photo count (D-30) is a head-only count of the request's photo rows; no document column is read.
  it("matches D-30 exactly", () => {
    expect(TENANT_COLUMNS).toEqual({
      tenancy: ["name", "phone", "moved_in_on"],
      agreement: ["starts_on", "ends_on"],
      unit: ["unit_number", "type"],
      property: ["name"],
      landlord: ["name", "receipt_name", "phone", "logo_document_id"],
      request: ["request_number", "category", "created_at", "status"],
      message: ["body"],
      audit_event: ["new_value", "created_at"],
      payment: ["amount", "received_on", "reference", "receipt_number"],
      rent_entry: ["month"],
    });
  });

  it("names none of the columns G-2 and D-30 forbid", () => {
    const all = Object.values(TENANT_COLUMNS).flat();
    for (const forbidden of [
      "rent",
      "amount_due",
      "deposit_amount",
      "deposit_paid",
      "cost",
      "no_cost",
      "tenant_liable",
      "vendor_id",
      "urgency",
      "reported_urgency",
      "suggested_urgency",
      "suggested_category",
      "reported_category",
      "description",
      "note",
      "email",
      "upi_id",
      "address",
      "tenant_token",
      "door_token",
      "*",
    ]) {
      expect(all).not.toContain(forbidden);
    }
  });

  it("is frozen", () => {
    expect(Object.isFrozen(TENANT_COLUMNS)).toBe(true);
    for (const list of Object.values(TENANT_COLUMNS)) expect(Object.isFrozen(list)).toBe(true);
  });
});
