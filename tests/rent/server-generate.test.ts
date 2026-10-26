// D-24: the 1st-of-month job and the L04-BNR-ROWSMISSING retry share one idempotent path, and the
// idempotency comes from the database's unique (tenancy_id, month), not from a pre-check.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateRentRows, missingRentRows, runMonthlyRentJob } from "@/server/landlord/rent/generate";

import { fakeDb } from "./fake-db";

const seed = () => ({
  tenancy: [
    { id: "t-4c", landlord_id: "L1", unit_id: "u-4c", moved_in_on: "2025-11-01", ended_on: null },
    { id: "t-g1", landlord_id: "L1", unit_id: "u-g1", moved_in_on: "2026-10-12", ended_on: null },
    { id: "t-gone", landlord_id: "L1", unit_id: "u-2b", moved_in_on: "2024-01-01", ended_on: "2026-09-20" },
  ],
  agreement: [
    { id: "a-4c", tenancy_id: "t-4c", starts_on: "2025-11-01", ends_on: "2026-09-30", rent: 18_000, rent_due_day: 31 },
    { id: "a-g1", tenancy_id: "t-g1", starts_on: "2026-10-12", ends_on: "2027-09-11", rent: 10_000, rent_due_day: 1 },
    { id: "a-gone", tenancy_id: "t-gone", starts_on: "2024-01-01", ends_on: "2026-12-31", rent: 9_000, rent_due_day: 1 },
  ],
});

describe("generateRentRows", () => {
  it("creates a full row, a pro-rata row, and nothing for the vacated unit", async () => {
    const db = fakeDb(seed());
    const result = await generateRentRows(db.client, "2026-10");
    expect(result).toEqual({ planned: 2, created: 2, skipped: [] });
    const rows = db.tables.rent_entry;
    expect(rows.find((r) => r.tenancy_id === "t-4c")).toMatchObject({
      month: "2026-10-01",
      amount_due: 18_000, // expired term continues (D-08)
      due_on: "2026-10-31",
      is_pro_rata: false,
    });
    expect(rows.find((r) => r.tenancy_id === "t-g1")).toMatchObject({
      amount_due: 6_452, // 10,000 × 20 ÷ 31
      due_on: "2026-10-12",
      is_pro_rata: true,
    });
    expect(rows.some((r) => r.tenancy_id === "t-gone")).toBe(false);
  });

  it("is idempotent through ON CONFLICT (tenancy_id, month) DO NOTHING, not a read-then-write", async () => {
    const db = fakeDb(seed());
    await generateRentRows(db.client, "2026-10");
    const again = await generateRentRows(db.client, "2026-10");
    expect(again.created).toBe(0);
    expect(db.tables.rent_entry).toHaveLength(2);

    const writes = db.ops.filter((op) => op.table === "rent_entry" && op.action !== "select");
    expect(writes.every((op) => op.action === "upsert")).toBe(true);
    expect(writes[0].options).toEqual({ onConflict: "tenancy_id,month", ignoreDuplicates: true });
    // No pre-check of existing rows: the constraint is the guard, so two concurrent runs are safe.
    expect(db.ops.some((op) => op.table === "rent_entry" && op.action === "select")).toBe(false);
  });

  it("never alters a generated row when a renewal is recorded afterwards (D-08, L-12)", async () => {
    const db = fakeDb(seed());
    await generateRentRows(db.client, "2026-10");
    // Renewal back-dated to cover the 1st, recorded after the row exists.
    db.tables.agreement.push({ id: "a-4c-2", tenancy_id: "t-4c", starts_on: "2026-10-01", ends_on: "2027-08-31", rent: 19_000, rent_due_day: 5 });
    await generateRentRows(db.client, "2026-10");
    const row = db.tables.rent_entry.find((r) => r.tenancy_id === "t-4c");
    expect(row).toMatchObject({ agreement_id: "a-4c", amount_due: 18_000, due_on: "2026-10-31" });
    expect(db.ops.some((op) => op.table === "rent_entry" && (op.action === "update" || op.action === "delete"))).toBe(false);
  });

  it("does nothing at all when every unit is vacant", async () => {
    const db = fakeDb({ tenancy: [], agreement: [] });
    expect(await generateRentRows(db.client, "2026-10")).toEqual({ planned: 0, created: 0, skipped: [] });
    expect(db.ops.some((op) => op.table === "rent_entry")).toBe(false);
  });

  it("surfaces an insert failure instead of reporting success", async () => {
    const db = fakeDb(seed());
    db.failNext("rent_entry", "connection reset");
    await expect(generateRentRows(db.client, "2026-10")).rejects.toThrow("connection reset");
  });
});

describe("missingRentRows (L04-BNR-ROWSMISSING)", () => {
  it("counts planned rows that do not exist yet, and is zero once they are created", async () => {
    const db = fakeDb(seed());
    expect(await missingRentRows(db.client, "2026-10")).toBe(2);
    await generateRentRows(db.client, "2026-10");
    expect(await missingRentRows(db.client, "2026-10")).toBe(0);
  });
});

describe("runMonthlyRentJob runs on the 1st in Asia/Kolkata", () => {
  it("runs at 00:30 IST on 1 November, which is still 31 October in UTC, for November", async () => {
    const db = fakeDb(seed());
    const result = await runMonthlyRentJob(db.client, new Date("2026-10-31T19:00:00Z"));
    expect(result).toMatchObject({ ran: true, month: "2026-11", created: 2 });
    expect(db.tables.rent_entry.every((r) => r.month === "2026-11-01")).toBe(true);
  });

  it("does not run on the 1st in UTC when it is already the 2nd in Kolkata", async () => {
    const db = fakeDb(seed());
    const result = await runMonthlyRentJob(db.client, new Date("2026-11-01T19:00:00Z"));
    expect(result).toEqual({ ran: false, reason: "not_first_in_kolkata", kolkataDate: "2026-11-02" });
    expect(db.ops).toEqual([]);
  });
});

describe("schema guard", () => {
  it("rent_entry carries the unique (tenancy_id, month) constraint the job relies on", () => {
    const dir = path.resolve(__dirname, "../../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    const table = /create table public\.rent_entry \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "";
    expect(table).toMatch(/unique \(tenancy_id, month\)/);
  });
});
