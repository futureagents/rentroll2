// The real tenant repository against a recording Supabase client: every column it selects is in
// D-30 (or is one of the scoping ids), every read is filtered by the resolved landlord and tenancy,
// tenant links only resolve while active, and the one write (T-01) inserts exactly what T-01 says.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SCOPE_KEYS, SELECT, TENANT_COLUMNS } from "../../src/server/tenant/columns";
import { createSupabaseTenantRepo } from "../../src/server/tenant/repo";
import type { CheckedPhoto } from "../../src/lib/tenant/photos";
import type { ValidReport } from "../../src/lib/tenant/report";
import { fakeSupabase, selectedColumns, type Query } from "./fake-supabase";
import { SENTINELS, T } from "./fixtures";

const scope = { landlordId: "L-A", unitId: "U-A-2A", tenancyId: "TN-A-active" };
const filter = (q: Query, op: string, column: string) => q.filters.find(([o, c]) => o === op && c === column)?.[2];

const linkRow = {
  id: "TN-A-active",
  landlord_id: "L-A",
  unit_id: "U-A-2A",
  name: "Priya Deshpande",
  phone: "+919000000303",
  email: SENTINELS.tenantEmail,
  rent: SENTINELS.rent,
  unit: { unit_number: "2A", rent: SENTINELS.rent, property: { name: "Kulkarni Apartments", address: SENTINELS.address } },
  landlord: { name: "Anil Kulkarni", phone: "+919000000101", email: SENTINELS.landlordEmail },
};
const doorRow = {
  id: "U-A-2A",
  landlord_id: "L-A",
  unit_number: "2A",
  rent: SENTINELS.rent,
  property: { name: "Kulkarni Apartments", address: SENTINELS.address },
  landlord: { name: "Anil Kulkarni", phone: "+919000000101", email: SENTINELS.landlordEmail },
  tenancy: [{ id: "TN-A-active", name: "Priya Deshpande", deposit_paid: SENTINELS.deposit }],
};

describe("every select names only D-30 columns or scoping ids", () => {
  const roots: Record<keyof typeof SELECT, string> = {
    tenantLink: "tenancy",
    door: "unit",
    requests: "request",
    ownRequest: "request",
    created: "request",
    countOnly: "request",
    statusChanges: "audit_event",
    latestUpdate: "message",
    agreements: "agreement",
    receipts: "payment",
  };

  for (const [name, select] of Object.entries(SELECT)) {
    it(`SELECT.${name}`, () => {
      expect(select).not.toContain("*");
      const byTable = selectedColumns(select, roots[name as keyof typeof SELECT]);
      for (const [table, columns] of Object.entries(byTable)) {
        const allowed: readonly string[] = [
          ...((TENANT_COLUMNS as Record<string, readonly string[]>)[table] ?? []),
          ...SCOPE_KEYS,
        ];
        for (const column of columns) expect(allowed, `${table}.${column} in SELECT.${name}`).toContain(column);
      }
    });
  }

  it("src/server/tenant never passes a literal to .select(): only SELECT.<name>", () => {
    const dir = path.resolve(__dirname, "../../src/server/tenant");
    const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(path.join(dir, file), "utf8");
      for (const match of source.matchAll(/\.select\(\s*([^,)]*)/g)) {
        expect(match[1].trim(), `${file}: .select(${match[1]})`).toMatch(/^SELECT\.[a-zA-Z]+$/);
      }
    }
  });
});

describe("token lookups", () => {
  it("looks a tenant link up only among active tenancies (E4-2)", async () => {
    const { client, queries } = fakeSupabase(() => ({ data: null }));
    await createSupabaseTenantRepo(client).findTenantLink(T.aActive);
    const [q] = queries;
    expect(q.table).toBe("tenancy");
    expect(q.select).toBe(SELECT.tenantLink);
    expect(filter(q, "eq", "tenant_token")).toBe(T.aActive);
    expect(filter(q, "eq", "status")).toBe("active");
    expect(q.single).toBe("maybeSingle");
  });

  it("looks a door token up only on units with an active tenancy (T-01 vacant state)", async () => {
    const { client, queries } = fakeSupabase(() => ({ data: null }));
    await createSupabaseTenantRepo(client).findDoor(T.aDoorOccupied);
    const [q] = queries;
    expect(q.table).toBe("unit");
    expect(q.select).toBe(SELECT.door);
    expect(filter(q, "eq", "door_token")).toBe(T.aDoorOccupied);
    expect(filter(q, "eq", "tenancy.status")).toBe("active");
  });

  it("builds the tenant-link hit field by field from a row full of extras", async () => {
    const { client } = fakeSupabase(() => ({ data: linkRow }));
    const hit = await createSupabaseTenantRepo(client).findTenantLink(T.aActive);
    expect(hit).toEqual({
      scope,
      name: "Priya Deshpande",
      phone: "+919000000303",
      unitNumber: "2A",
      propertyName: "Kulkarni Apartments",
      landlordName: "Anil Kulkarni",
      landlordPhone: "+919000000101",
    });
  });

  it("builds the door hit field by field and attaches the active tenancy", async () => {
    const { client } = fakeSupabase(() => ({ data: doorRow }));
    const hit = await createSupabaseTenantRepo(client).findDoor(T.aDoorOccupied);
    expect(hit).toEqual({
      scope,
      unitNumber: "2A",
      propertyName: "Kulkarni Apartments",
      landlordName: "Anil Kulkarni",
      landlordPhone: "+919000000101",
    });
  });

  it("treats a door row without exactly one active tenancy as vacant", async () => {
    for (const tenancy of [[], [{ id: "x" }, { id: "y" }], null]) {
      const { client } = fakeSupabase(() => ({ data: { ...doorRow, tenancy } }));
      await expect(createSupabaseTenantRepo(client).findDoor(T.aDoorOccupied)).resolves.toBeNull();
    }
  });

  it("throws on a database error so the resolver fails closed", async () => {
    const { client } = fakeSupabase(() => ({ error: { code: "PGRST000", message: "down" } }));
    await expect(createSupabaseTenantRepo(client).findTenantLink(T.aActive)).rejects.toThrow();
  });
});

describe("request reads are scoped to the token's landlord and tenancy", () => {
  it("lists own requests newest first", async () => {
    const { client, queries } = fakeSupabase(() => ({
      data: [{ request_number: "R-0001", category: "plumbing", status: "new", created_at: "2026-10-20T09:30:00Z", cost: SENTINELS.cost }],
    }));
    const rows = await createSupabaseTenantRepo(client).listRequests(scope);
    const [q] = queries;
    expect(q.table).toBe("request");
    expect(q.select).toBe(SELECT.requests);
    expect(filter(q, "eq", "landlord_id")).toBe("L-A");
    expect(filter(q, "eq", "tenancy_id")).toBe("TN-A-active");
    expect(q.order).toEqual(["created_at", { ascending: false }]);
    expect(rows).toEqual([{ requestNumber: "R-0001", category: "plumbing", status: "new", createdAt: "2026-10-20T09:30:00Z" }]);
  });

  it("finds one own request by number, then counts only its tenant photos", async () => {
    const { client, queries } = fakeSupabase((q) =>
      q.table === "request"
        ? { data: { id: "RQ-1", request_number: "R-0001", category: "plumbing", status: "new", created_at: "2026-10-20T09:30:00Z", cost: 1 } }
        : { count: 2 },
    );
    const row = await createSupabaseTenantRepo(client).findRequest(scope, "R-0001");
    const [r, d] = queries;
    expect(filter(r, "eq", "landlord_id")).toBe("L-A");
    expect(filter(r, "eq", "tenancy_id")).toBe("TN-A-active");
    expect(filter(r, "eq", "request_number")).toBe("R-0001");
    expect(d.table).toBe("document");
    expect(d.selectOptions).toEqual({ count: "exact", head: true });
    expect(filter(d, "eq", "landlord_id")).toBe("L-A");
    expect(filter(d, "eq", "request_id")).toBe("RQ-1");
    expect(filter(d, "eq", "type")).toBe("request_before_photo");
    expect(row).toEqual({ requestNumber: "R-0001", category: "plumbing", status: "new", createdAt: "2026-10-20T09:30:00Z", photoCount: 2 });
  });

  it("does not count photos for a request that is not the tenancy's", async () => {
    const { client, queries } = fakeSupabase(() => ({ data: null }));
    await expect(createSupabaseTenantRepo(client).findRequest(scope, "R-0007")).resolves.toBeNull();
    expect(queries).toHaveLength(1);
  });

  it("counts tenant-link submissions in the window with a head-only query (T-01 rate limit)", async () => {
    const since = new Date("2026-10-26T09:00:00.000Z");
    const { client, queries } = fakeSupabase(() => ({ count: 3 }));
    await expect(createSupabaseTenantRepo(client).countTenantLinkRequestsSince(scope, since)).resolves.toBe(3);
    const [q] = queries;
    expect(q.selectOptions).toEqual({ count: "exact", head: true });
    expect(filter(q, "eq", "landlord_id")).toBe("L-A");
    expect(filter(q, "eq", "tenancy_id")).toBe("TN-A-active");
    expect(filter(q, "eq", "reported_via")).toBe("tenant_link");
    expect(filter(q, "gte", "created_at")).toBe(since.toISOString());
  });
});

describe("createRequest: the tenant side's one write (T-01, D-29, D-15)", () => {
  const report: ValidReport = {
    category: "plumbing",
    description: "Geyser is leaking from the bottom since yesterday.",
    urgency: "urgent",
    name: "Priya Deshpande",
    phone: "+919000000303",
  };
  const photo = (n: number): CheckedPhoto => ({ bytes: new Uint8Array([0xff, 0xd8, 0xff, n]), mime: "image/jpeg", extension: "jpg" });
  let ids = 0;
  const newId = () => `doc-${++ids}`;

  it("uploads photos, inserts the request with the tenant's own values, then its photo rows", async () => {
    ids = 0;
    const { client, queries, uploads } = fakeSupabase((q) =>
      q.table === "request" && q.op === "insert" ? { data: { id: "RQ-new", request_number: "R-0412" } } : {},
    );
    const created = await createSupabaseTenantRepo(client, { newId }).createRequest(scope, { report, photos: [photo(1), photo(2)] });
    expect(created).toEqual({ requestNumber: "R-0412" });

    expect(uploads.map((u) => [u.bucket, u.path, u.contentType, u.upsert])).toEqual([
      ["documents", "L-A/doc-1", "image/jpeg", false],
      ["documents", "L-A/doc-2", "image/jpeg", false],
    ]);

    const insert = queries.find((q) => q.table === "request" && q.op === "insert")!;
    expect(insert.payload).toEqual({
      landlord_id: "L-A",
      unit_id: "U-A-2A",
      tenancy_id: "TN-A-active",
      reported_via: "tenant_link",
      reporter_name: "Priya Deshpande",
      reporter_phone: "+919000000303",
      description: report.description,
      reported_category: "plumbing",
      reported_urgency: "urgent",
    });
    expect(insert.select).toBe(SELECT.created);

    const docs = queries.find((q) => q.table === "document" && q.op === "insert")!;
    expect(docs.payload).toEqual([1, 2].map((n) => ({
      id: `doc-${n}`,
      landlord_id: "L-A",
      unit_id: "U-A-2A",
      tenancy_id: "TN-A-active",
      request_id: "RQ-new",
      type: "request_before_photo",
      storage_path: `L-A/doc-${n}`,
      file_name: `R-0412-photo-${n}.jpg`,
      mime: "image/jpeg",
      size_bytes: 4,
      alt_text: `Photo ${n} of 2 from tenant report R-0412 (Plumbing)`,
      uploaded_by: "tenant",
    })));
    // Nothing else is written from tenant code: no message, no audit row, no update (tenant-routes rules, G-1).
    expect(queries.filter((q) => q.op !== "select").map((q) => `${q.op}:${q.table}`)).toEqual(["insert:request", "insert:document"]);
  });

  it("never sets the effective or suggested values itself (the triggers and D-21 own those)", async () => {
    const { client, queries } = fakeSupabase(() => ({ data: { id: "RQ-new", request_number: "R-0412" } }));
    await createSupabaseTenantRepo(client, { newId }).createRequest(scope, { report, photos: [] });
    const payload = queries.find((q) => q.op === "insert")!.payload as Record<string, unknown>;
    for (const key of ["category", "urgency", "suggested_category", "suggested_urgency", "status", "request_number", "cost"]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("removes uploaded photos when the request insert is refused", async () => {
    ids = 0;
    const { client, removed } = fakeSupabase((q) => (q.op === "insert" ? { error: { code: "23514", message: "check" } } : {}));
    await expect(createSupabaseTenantRepo(client, { newId }).createRequest(scope, { report, photos: [photo(1)] })).rejects.toThrow();
    expect(removed).toEqual([["L-A/doc-1"]]);
  });

  it("removes the request and the photos when the photo rows are refused", async () => {
    ids = 0;
    const { client, queries, removed } = fakeSupabase((q) =>
      q.table === "request" && q.op === "insert"
        ? { data: { id: "RQ-new", request_number: "R-0412" } }
        : q.table === "document"
          ? { error: { code: "23503", message: "fk" } }
          : {},
    );
    await expect(createSupabaseTenantRepo(client, { newId }).createRequest(scope, { report, photos: [photo(1)] })).rejects.toThrow();
    const del = queries.find((q) => q.op === "delete")!;
    expect(del.table).toBe("request");
    expect(filter(del, "eq", "id")).toBe("RQ-new");
    expect(filter(del, "eq", "landlord_id")).toBe("L-A");
    expect(removed).toEqual([["L-A/doc-1"]]);
  });

  it("stops before touching the database when an upload is refused", async () => {
    ids = 0;
    const { client, queries, removed } = fakeSupabase(() => ({}), { failUpload: (p) => p.endsWith("doc-2") });
    await expect(createSupabaseTenantRepo(client, { newId }).createRequest(scope, { report, photos: [photo(1), photo(2)] })).rejects.toThrow();
    expect(queries).toEqual([]);
    expect(removed).toEqual([["L-A/doc-1", "L-A/doc-2"]]);
  });
});
