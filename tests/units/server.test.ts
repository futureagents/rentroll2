// The units lane's server writes against the landlord's RLS-scoped client: L09-FRM-ADDTENANT
// (D-24, D-39), uploads (D-15, E4-7), L08-BTN-ADDUNIT (D-39), the door code (D-01), delete
// (D-39), End tenancy (D-05, E4-2) and Record notice (D-13). Cross-landlord ids are Not found (E4-5).
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyUploads } from "@/server/landlord/units/files";
import {
  addTenancy,
  attachDocuments,
  createUnit,
  deleteUnit,
  endTenancy,
  recordNotice,
  regenerateDoorToken,
  type AddTenancyInput,
} from "@/server/landlord/units/mutations";

import { fakeSupabase } from "./fake-supabase";

const ME = "3f0f6c2e-6d7a-4c1b-9a51-1f2e3d4c5b6a";
const OTHER = "9b9b9b9b-6d7a-4c1b-9a51-1f2e3d4c5b6a";
const UNIT = "11111111-1111-4111-8111-111111111111";
const OTHER_UNIT = "22222222-2222-4222-8222-222222222222";
const TENANCY = "33333333-3333-4333-8333-333333333333";
const OTHER_TENANCY = "44444444-4444-4444-8444-444444444444";
const PHOTO = "55555555-5555-4555-8555-555555555555";
const PHOTO2 = "66666666-6666-4666-8666-666666666666";
const TODAY = "2026-10-26";

const seed = () => ({
  property: [
    { id: "p-k", landlord_id: ME, name: "Kulkarni Apartments", address: "Kothrud, Pune" },
    { id: "p-x", landlord_id: OTHER, name: "Elsewhere", address: "Mumbai" },
  ],
  unit: [
    { id: UNIT, landlord_id: ME, property_id: "p-k", unit_number: "4C", rent: 18000, deposit_amount: 54000, door_token: "d".repeat(40) },
    { id: OTHER_UNIT, landlord_id: OTHER, property_id: "p-x", unit_number: "1A", rent: 9000, deposit_amount: 0, door_token: "e".repeat(40) },
  ],
  tenancy: [
    { id: OTHER_TENANCY, landlord_id: OTHER, unit_id: OTHER_UNIT, status: "active", moved_in_on: "2025-01-01" },
  ],
});

const form = (overrides: Partial<AddTenancyInput> = {}): AddTenancyInput => ({
  name: "Meera Desai",
  phone: "9876543210",
  email: "",
  movedInOn: "2026-11-16",
  startsOn: "2026-11-16",
  endsOn: "2027-10-31",
  rent: 18000,
  rentDueDay: 5,
  depositPaid: 54000,
  depositReceivedOn: "2026-11-10",
  photos: [],
  idProof: null,
  ...overrides,
});

describe("addTenancy (L09-FRM-ADDTENANT, D-39)", () => {
  it("creates the tenancy with its link, the first agreement, the first rent row and the photos", async () => {
    const fake = fakeSupabase(ME, seed());
    fake.objects.set(`${ME}/${PHOTO}`, { contentType: "image/jpeg", size: 400_000 });
    const result = await addTenancy(fake.db, fake.admin, ME, UNIT, form({ photos: [{ documentId: PHOTO, type: "move_in_photo", fileName: "hall.jpg", alt: "Hall" }] }));
    expect(result.ok).toBe(true);

    const tenancy = fake.tables.tenancy.find((t) => t.unit_id === UNIT);
    expect(tenancy).toMatchObject({ name: "Meera Desai", phone: "+919876543210", moved_in_on: "2026-11-16", deposit_paid: 54000, status: "active" });
    expect(tenancy?.tenant_token).toBeTruthy();
    expect(fake.tables.agreement).toEqual([
      expect.objectContaining({ tenancy_id: tenancy?.id, starts_on: "2026-11-16", ends_on: "2027-10-31", rent: 18000, rent_due_day: 5 }),
    ]);
    // D-24: moving in on the 16th of a 30-day month → pro-rata 9000, due on the move-in date.
    expect(fake.tables.rent_entry).toEqual([
      expect.objectContaining({ tenancy_id: tenancy?.id, unit_id: UNIT, month: "2026-11-01", amount_due: 9000, due_on: "2026-11-16", is_pro_rata: true }),
    ]);
    expect(fake.tables.document).toEqual([
      expect.objectContaining({ id: PHOTO, landlord_id: ME, type: "move_in_photo", tenancy_id: tenancy?.id, unit_id: UNIT, storage_path: `${ME}/${PHOTO}`, mime: "image/jpeg", uploaded_by: "landlord" }),
    ]);
  });

  it("saves with no photos — the step is skippable", async () => {
    const fake = fakeSupabase(ME, seed());
    expect((await addTenancy(fake.db, fake.admin, ME, UNIT, form())).ok).toBe(true);
    expect(fake.tables.document ?? []).toEqual([]);
  });

  it("refuses while the unit has an active tenancy", async () => {
    const fake = fakeSupabase(ME, { ...seed(), tenancy: [{ id: TENANCY, landlord_id: ME, unit_id: UNIT, status: "active", moved_in_on: "2025-01-01" }] });
    const result = await addTenancy(fake.db, fake.admin, ME, UNIT, form());
    expect(result).toEqual({ ok: false, error: "This unit already has a tenant. End that tenancy first." });
  });

  it("undoes the tenancy when a later row fails, leaving nothing half-saved", async () => {
    const fake = fakeSupabase(ME, seed());
    fake.failNext("rent_entry");
    const result = await addTenancy(fake.db, fake.admin, ME, UNIT, form());
    expect(result.ok).toBe(false);
    expect(fake.tables.tenancy.filter((t) => t.landlord_id === ME)).toEqual([]);
    expect(fake.tables.agreement ?? []).toEqual([]);
  });

  it("is Not found for another landlord's unit, and writes nothing (E4-5)", async () => {
    const fake = fakeSupabase(ME, seed());
    expect(await addTenancy(fake.db, fake.admin, ME, OTHER_UNIT, form())).toEqual({ ok: false, error: "Not found." });
    expect(fake.tables.tenancy).toHaveLength(1);
  });

  it("rejects the save when the form is invalid, before touching the database", async () => {
    const fake = fakeSupabase(ME, seed());
    const result = await addTenancy(fake.db, fake.admin, ME, UNIT, form({ rent: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.rent).toBeDefined();
    expect(fake.tables.tenancy).toHaveLength(1);
  });
});

describe("uploads are checked against what storage holds (D-15, E4-7)", () => {
  it("refuses a document id that was never uploaded to this landlord's folder", async () => {
    const fake = fakeSupabase(ME, seed());
    fake.objects.set(`${OTHER}/${PHOTO}`, { contentType: "image/jpeg", size: 1000 }); // another landlord's file
    const result = await verifyUploads(fake.db, fake.admin, ME, [{ documentId: PHOTO, type: "move_in_photo", fileName: "x.jpg", alt: null }]);
    expect(result.ok).toBe(false);
  });

  it("refuses a stored file whose real type is not allowed, and deletes nothing", async () => {
    const fake = fakeSupabase(ME, seed());
    fake.objects.set(`${ME}/${PHOTO}`, { contentType: "text/html", size: 1000 });
    const result = await addTenancy(fake.db, fake.admin, ME, UNIT, form({ photos: [{ documentId: PHOTO, type: "move_in_photo", fileName: "x.jpg", alt: null }] }));
    expect(result.ok).toBe(false);
    expect(fake.removed).toEqual([]);
    expect(fake.tables.tenancy).toHaveLength(1);
  });

  it("never re-attaches or deletes an existing file, a settled statement included (D-15)", async () => {
    const STATEMENT = "77777777-7777-4777-8777-777777777777";
    const fake = fakeSupabase(ME, {
      ...seed(),
      tenancy: [...seed().tenancy, { id: TENANCY, landlord_id: ME, unit_id: UNIT, status: "active", moved_in_on: "2025-01-01" }],
      document: [{ id: STATEMENT, landlord_id: ME, unit_id: UNIT, type: "statement", storage_path: `${ME}/${STATEMENT}`, is_protected: true }],
    });
    fake.objects.set(`${ME}/${STATEMENT}`, { contentType: "application/pdf", size: 50_000 });
    for (const type of ["move_in_photo", "agreement"] as const) {
      const result = await attachDocuments(fake.db, fake.admin, ME, { tenancyId: TENANCY, type, files: [{ documentId: STATEMENT, fileName: "s.pdf", alt: null }] });
      expect(result.ok).toBe(false);
    }
    expect(fake.removed).toEqual([]);
    expect(fake.objects.has(`${ME}/${STATEMENT}`)).toBe(true);
    expect(fake.tables.document).toHaveLength(1);
  });

  it("refuses a path-like document id", async () => {
    const fake = fakeSupabase(ME, seed());
    const result = await verifyUploads(fake.db, fake.admin, ME, [{ documentId: `../${OTHER}/${PHOTO}`, type: "agreement", fileName: "a.pdf", alt: null }]);
    expect(result.ok).toBe(false);
  });

  it("attaches later photos only to the landlord's own tenancy", async () => {
    const fake = fakeSupabase(ME, { ...seed(), tenancy: [...seed().tenancy, { id: TENANCY, landlord_id: ME, unit_id: UNIT, status: "active", moved_in_on: "2025-01-01" }] });
    fake.objects.set(`${ME}/${PHOTO2}`, { contentType: "image/webp", size: 2000 });
    expect(
      await attachDocuments(fake.db, fake.admin, ME, { tenancyId: OTHER_TENANCY, type: "move_in_photo", files: [{ documentId: PHOTO2, fileName: "a.webp", alt: "x" }] }),
    ).toEqual({ ok: false, error: "Not found." });
    const ok = await attachDocuments(fake.db, fake.admin, ME, { tenancyId: TENANCY, type: "move_in_photo", files: [{ documentId: PHOTO2, fileName: "a.webp", alt: "x" }] });
    expect(ok).toEqual({ ok: true, count: 1 });
  });
});

describe("createUnit (L08-BTN-ADDUNIT, D-39)", () => {
  const input = { propertyId: "p-k" as string | null, propertyName: "", propertyAddress: "", unitNumber: "5A", type: "2BHK", rent: 18000, deposit: null };

  it("adds a unit to an existing property; the door token comes from the database", async () => {
    const fake = fakeSupabase(ME, seed());
    const result = await createUnit(fake.db, ME, input);
    expect(result.ok).toBe(true);
    expect(fake.tables.unit.find((u) => u.unit_number === "5A")).toMatchObject({ property_id: "p-k", rent: 18000, deposit_amount: 0, type: "2BHK" });
  });

  it("refuses a number the property already has", async () => {
    const fake = fakeSupabase(ME, seed());
    const result = await createUnit(fake.db, ME, { ...input, unitNumber: "4c" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.unitNumber).toBe("Kulkarni Apartments already has a unit 4c.");
  });

  it("refuses another landlord's property id", async () => {
    const fake = fakeSupabase(ME, seed());
    const result = await createUnit(fake.db, ME, { ...input, propertyId: "p-x" });
    expect(result.ok).toBe(false);
    expect(fake.tables.unit).toHaveLength(2);
  });

  it("creates the property first for “Add a property…”, and removes it if the unit fails", async () => {
    const fake = fakeSupabase(ME, seed());
    fake.failNext("unit");
    const failed = await createUnit(fake.db, ME, { ...input, propertyId: null, propertyName: "Shanti Niwas", propertyAddress: "Karve Road" });
    expect(failed.ok).toBe(false);
    expect(fake.tables.property.map((p) => p.name)).toEqual(["Kulkarni Apartments", "Elsewhere"]);

    const ok = await createUnit(fake.db, ME, { ...input, propertyId: null, propertyName: "Shanti Niwas", propertyAddress: "Karve Road" });
    expect(ok.ok).toBe(true);
    const property = fake.tables.property.find((p) => p.name === "Shanti Niwas");
    expect(property?.landlord_id).toBe(ME);
    expect(fake.tables.unit.find((u) => u.unit_number === "5A")?.property_id).toBe(property?.id);
  });
});

describe("the door code (D-01, D-14)", () => {
  it("is replaced with a fresh 160-bit token and the replacement is audited", async () => {
    const fake = fakeSupabase(ME, seed());
    expect(await regenerateDoorToken(fake.db, ME, UNIT)).toEqual({ ok: true });
    const token = fake.tables.unit.find((u) => u.id === UNIT)?.door_token as string;
    expect(token).toMatch(/^[0-9a-f]{40}$/);
    expect(token).not.toBe("d".repeat(40));
    expect(fake.tables.audit_event).toEqual([expect.objectContaining({ entity_type: "unit", entity_id: UNIT, kind: "door_token_regenerated", actor: "landlord" })]);
    expect(JSON.stringify(fake.tables.audit_event)).not.toContain(token);
  });
  it("cannot be replaced on another landlord's unit", async () => {
    const fake = fakeSupabase(ME, seed());
    expect(await regenerateDoorToken(fake.db, ME, OTHER_UNIT)).toEqual({ ok: false, error: "Not found." });
    expect(fake.tables.unit.find((u) => u.id === OTHER_UNIT)?.door_token).toBe("e".repeat(40));
  });
});

describe("deleteUnit (D-39)", () => {
  it("is refused once the unit has had a tenant", async () => {
    const fake = fakeSupabase(ME, { ...seed(), tenancy: [{ id: TENANCY, landlord_id: ME, unit_id: UNIT, status: "ended", moved_in_on: "2024-01-01" }] });
    const result = await deleteUnit(fake.db, fake.admin, UNIT);
    expect(result.ok).toBe(false);
    expect(fake.tables.unit.some((u) => u.id === UNIT)).toBe(true);
  });
  it("removes a unit with no history", async () => {
    const fake = fakeSupabase(ME, seed());
    expect(await deleteUnit(fake.db, fake.admin, UNIT)).toEqual({ ok: true });
    expect(fake.tables.unit.some((u) => u.id === UNIT)).toBe(false);
  });
});

describe("endTenancy (L11-BTN-ENDTENANCY, D-05, E4-2)", () => {
  const withTenancy = () =>
    fakeSupabase(ME, { ...seed(), tenancy: [...seed().tenancy, { id: TENANCY, landlord_id: ME, unit_id: UNIT, status: "active", moved_in_on: "2025-04-01" }] });

  it("sets ended_on and status ended, which revokes the tenant link, and audits it", async () => {
    const fake = withTenancy();
    expect(await endTenancy(fake.db, ME, TENANCY, "2026-10-20", TODAY)).toEqual({ ok: true });
    expect(fake.tables.tenancy.find((t) => t.id === TENANCY)).toMatchObject({ status: "ended", ended_on: "2026-10-20" });
    expect(fake.tables.audit_event).toEqual([expect.objectContaining({ entity_type: "tenancy", kind: "tenancy_ended" })]);
    expect(await endTenancy(fake.db, ME, TENANCY, "2026-10-20", TODAY)).toEqual({ ok: false, error: "This tenancy has already ended." });
  });
  it("refuses a move-out date in the future or before move-in", async () => {
    const fake = withTenancy();
    expect((await endTenancy(fake.db, ME, TENANCY, "2026-10-27", TODAY)).ok).toBe(false);
    expect((await endTenancy(fake.db, ME, TENANCY, "2025-03-31", TODAY)).ok).toBe(false);
    expect(fake.tables.tenancy.find((t) => t.id === TENANCY)?.status).toBe("active");
  });
  it("is Not found for another landlord's tenancy", async () => {
    const fake = withTenancy();
    expect(await endTenancy(fake.db, ME, OTHER_TENANCY, "2026-10-20", TODAY)).toEqual({ ok: false, error: "Not found." });
    expect(fake.tables.tenancy.find((t) => t.id === OTHER_TENANCY)?.status).toBe("active");
  });
});

describe("recordNotice (L11-BTN-RECORDNOTICE †, D-13)", () => {
  it("records both dates on an active tenancy and audits the change", async () => {
    const fake = fakeSupabase(ME, { ...seed(), tenancy: [{ id: TENANCY, landlord_id: ME, unit_id: UNIT, status: "active", notice_given_on: null, notice_vacate_on: null }] });
    expect(await recordNotice(fake.db, ME, TENANCY, "2026-10-26", "2026-11-25")).toEqual({ ok: true });
    expect(fake.tables.tenancy[0]).toMatchObject({ notice_given_on: "2026-10-26", notice_vacate_on: "2026-11-25" });
    expect(fake.tables.audit_event).toEqual([
      expect.objectContaining({ kind: "notice_recorded", new_value: { notice_given_on: "2026-10-26", notice_vacate_on: "2026-11-25" } }),
    ]);
  });
  it("refuses a vacate date before the notice date", async () => {
    const fake = fakeSupabase(ME, { ...seed(), tenancy: [{ id: TENANCY, landlord_id: ME, unit_id: UNIT, status: "active" }] });
    const result = await recordNotice(fake.db, ME, TENANCY, "2026-10-26", "2026-10-01");
    expect(result.ok).toBe(false);
  });
  it("refuses a tenancy that has ended", async () => {
    const fake = fakeSupabase(ME, { ...seed(), tenancy: [{ id: TENANCY, landlord_id: ME, unit_id: UNIT, status: "ended" }] });
    expect((await recordNotice(fake.db, ME, TENANCY, "2026-10-26", "2026-11-25")).ok).toBe(false);
  });
});
