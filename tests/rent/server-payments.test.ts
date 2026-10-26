// L04-BTN-MARKPAID, bulk mark-paid, Undo, L05-BTN-EDIT and L05-BTN-LOGCALL against the payment,
// audit_event and message tables (D-10, D-11, D-14, D-17, D-25).
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { editAmountDue, logCall, recordPayments, voidPayments } from "@/server/landlord/rent/mutations";

import { fakeDb } from "./fake-db";

const TODAY = "2026-10-26";
const LANDLORD = "L1";

const seed = () => ({
  rent_entry: [
    { id: "e-4c", landlord_id: LANDLORD, tenancy_id: "t-4c", unit_id: "u-4c", month: "2026-10-01", amount_due: 18_000, due_on: "2026-10-05", is_pro_rata: false },
    { id: "e-f1", landlord_id: LANDLORD, tenancy_id: "t-f1", unit_id: "u-f1", month: "2026-10-01", amount_due: 12_000, due_on: "2026-10-05", is_pro_rata: false },
    { id: "e-1a", landlord_id: LANDLORD, tenancy_id: "t-1a", unit_id: "u-1a", month: "2026-10-01", amount_due: 16_000, due_on: "2026-10-05", is_pro_rata: false },
  ],
  payment: [
    { id: "p-f1", landlord_id: LANDLORD, rent_entry_id: "e-f1", tenancy_id: "t-f1", amount: 8_000, received_on: "2026-10-03", receipt_number: "RR-0840", status: "recorded" },
    { id: "p-1a", landlord_id: LANDLORD, rent_entry_id: "e-1a", tenancy_id: "t-1a", amount: 16_000, received_on: "2026-10-02", receipt_number: "RR-0841", status: "recorded" },
  ],
});

describe("recordPayments: Mark paid writes a payment row, never fields on the rent entry (D-10)", () => {
  it("inserts one payment and returns its receipt number", async () => {
    const db = fakeDb(seed());
    const result = await recordPayments(db.client, LANDLORD, {
      items: [{ rentEntryId: "e-4c", amount: 18_000 }],
      receivedOn: TODAY,
      reference: "UPI 4471",
      today: TODAY,
    });
    expect(result).toEqual({ ok: true, payments: [{ id: expect.any(String), rentEntryId: "e-4c", receiptNumber: "RR-0847" }] });
    expect(db.tables.payment.at(-1)).toMatchObject({ rent_entry_id: "e-4c", amount: 18_000, received_on: TODAY, reference: "UPI 4471" });
    expect(db.ops.some((op) => op.table === "rent_entry" && op.action === "update")).toBe(false);
  });

  it("records a part payment and leaves the balance recordable afterwards", async () => {
    const db = fakeDb(seed());
    const first = await recordPayments(db.client, LANDLORD, { items: [{ rentEntryId: "e-4c", amount: 14_000 }], receivedOn: TODAY, reference: "", today: TODAY });
    expect(first.ok).toBe(true);
    const second = await recordPayments(db.client, LANDLORD, { items: [{ rentEntryId: "e-4c", amount: 4_000 }], receivedOn: TODAY, reference: "", today: TODAY });
    expect(second.ok).toBe(true);
    const receipts = db.tables.payment.filter((p) => p.rent_entry_id === "e-4c").map((p) => p.receipt_number);
    expect(receipts).toEqual(["RR-0847", "RR-0848"]); // a receipt for each amount actually received
  });

  it("refuses more than the balance and writes nothing", async () => {
    const db = fakeDb(seed());
    const result = await recordPayments(db.client, LANDLORD, { items: [{ rentEntryId: "e-f1", amount: 4_001 }], receivedOn: TODAY, reference: "", today: TODAY });
    expect(result).toEqual({ ok: false, error: "That is more than the ₹4,000 still due." });
    expect(db.ops.some((op) => op.table === "payment" && op.action === "insert")).toBe(false);
  });

  it("stores an empty reference as null", async () => {
    const db = fakeDb(seed());
    await recordPayments(db.client, LANDLORD, { items: [{ rentEntryId: "e-4c", amount: 100 }], receivedOn: TODAY, reference: "  ", today: TODAY });
    expect(db.tables.payment.at(-1)?.reference).toBeNull();
  });

  it("says Not found for a rent entry RLS does not return (E4-5)", async () => {
    const db = fakeDb(seed());
    const result = await recordPayments(db.client, LANDLORD, { items: [{ rentEntryId: "other-landlord", amount: 100 }], receivedOn: TODAY, reference: "", today: TODAY });
    expect(result).toEqual({ ok: false, error: "Not found." });
  });

  it("writes a payment_recorded audit event per payment (D-14)", async () => {
    const db = fakeDb(seed());
    await recordPayments(db.client, LANDLORD, { items: [{ rentEntryId: "e-4c", amount: 18_000 }], receivedOn: TODAY, reference: "", today: TODAY });
    expect(db.tables.audit_event).toEqual([
      expect.objectContaining({
        landlord_id: LANDLORD,
        actor: "landlord",
        entity_type: "payment",
        kind: "payment_recorded",
        new_value: { rent_entry_id: "e-4c", amount: 18_000, received_on: TODAY, receipt_number: "RR-0847" },
      }),
    ]);
  });
});

describe("bulk mark-paid", () => {
  it("records every selected balance in one insert statement, so it lands all-or-nothing", async () => {
    const db = fakeDb(seed());
    const result = await recordPayments(db.client, LANDLORD, {
      items: [
        { rentEntryId: "e-4c", amount: 18_000 },
        { rentEntryId: "e-f1", amount: 4_000 },
      ],
      receivedOn: TODAY,
      reference: "",
      today: TODAY,
    });
    expect(result.ok && result.payments.map((p) => p.receiptNumber)).toEqual(["RR-0847", "RR-0848"]);
    const inserts = db.ops.filter((op) => op.table === "payment" && op.action === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toHaveLength(2);
  });

  it("refuses the whole batch when any one row would be overpaid", async () => {
    const db = fakeDb(seed());
    const result = await recordPayments(db.client, LANDLORD, {
      items: [
        { rentEntryId: "e-4c", amount: 18_000 },
        { rentEntryId: "e-1a", amount: 1 },
      ],
      receivedOn: TODAY,
      reference: "",
      today: TODAY,
    });
    expect(result).toEqual({ ok: false, error: "This month is already paid." });
    expect(db.ops.some((op) => op.table === "payment" && op.action === "insert")).toBe(false);
  });

  it("refuses the same rent entry twice in one batch", async () => {
    const db = fakeDb(seed());
    const result = await recordPayments(db.client, LANDLORD, {
      items: [
        { rentEntryId: "e-4c", amount: 9_000 },
        { rentEntryId: "e-4c", amount: 9_000 },
      ],
      receivedOn: TODAY,
      reference: "",
      today: TODAY,
    });
    expect(result.ok).toBe(false);
  });
});

describe("voidPayments: Undo voids and retains the receipt number (D-11)", () => {
  it("marks the payment voided with a timestamp and never deletes it", async () => {
    const db = fakeDb(seed());
    const result = await voidPayments(db.client, LANDLORD, ["p-f1"], "undo");
    expect(result).toEqual({ ok: true, voided: ["RR-0840"] });
    expect(db.tables.payment.find((p) => p.id === "p-f1")).toMatchObject({ status: "voided", receipt_number: "RR-0840", voided_at: expect.any(String) });
    expect(db.ops.some((op) => op.table === "payment" && op.action === "delete")).toBe(false);
  });

  it("does not re-void a payment that is already voided", async () => {
    const db = fakeDb(seed());
    await voidPayments(db.client, LANDLORD, ["p-f1"], "undo");
    const again = await voidPayments(db.client, LANDLORD, ["p-f1"], "undo");
    expect(again).toEqual({ ok: false, error: "That payment was already voided." });
  });

  it("writes a payment_voided audit event saying how it was voided", async () => {
    const db = fakeDb(seed());
    await voidPayments(db.client, LANDLORD, ["p-f1"], "panel");
    expect(db.tables.audit_event).toEqual([
      expect.objectContaining({ entity_type: "payment", entity_id: "p-f1", kind: "payment_voided", note: "Voided from the rent detail panel" }),
    ]);
  });

  it("allocates a fresh number for the re-recorded payment instead of reusing the voided one", async () => {
    const db = fakeDb(seed());
    await voidPayments(db.client, LANDLORD, ["p-f1"], "undo");
    await recordPayments(db.client, LANDLORD, { items: [{ rentEntryId: "e-f1", amount: 12_000 }], receivedOn: TODAY, reference: "", today: TODAY });
    const numbers = db.tables.payment.filter((p) => p.rent_entry_id === "e-f1").map((p) => `${p.receipt_number} ${p.status}`);
    expect(numbers).toEqual(["RR-0840 voided", "RR-0847 recorded"]);
  });
});

describe("editAmountDue writes an audit event with old and new value (D-25, D-14)", () => {
  it("updates amount_due and logs amount_edit", async () => {
    const db = fakeDb(seed());
    const result = await editAmountDue(db.client, LANDLORD, { rentEntryId: "e-4c", next: 15_000, today: TODAY });
    expect(result).toEqual({ ok: true });
    expect(db.tables.rent_entry.find((r) => r.id === "e-4c")?.amount_due).toBe(15_000);
    expect(db.tables.audit_event).toEqual([
      expect.objectContaining({
        landlord_id: LANDLORD,
        actor: "landlord",
        entity_type: "rent_entry",
        entity_id: "e-4c",
        kind: "amount_edit",
        old_value: { amount_due: 18_000 },
        new_value: { amount_due: 15_000 },
      }),
    ]);
  });

  it("guards the update on the old amount so a concurrent edit is not overwritten", async () => {
    const db = fakeDb(seed());
    await editAmountDue(db.client, LANDLORD, { rentEntryId: "e-4c", next: 15_000, today: TODAY });
    const update = db.ops.find((op) => op.table === "rent_entry" && op.action === "update");
    expect(update?.payload).toEqual({ amount_due: 15_000 });
  });

  it("refuses an edit on a Paid row and below the amount received", async () => {
    const db = fakeDb(seed());
    expect(await editAmountDue(db.client, LANDLORD, { rentEntryId: "e-1a", next: 17_000, today: TODAY })).toEqual({
      ok: false,
      error: "A paid month cannot be edited. Void its payment first.",
    });
    expect(await editAmountDue(db.client, LANDLORD, { rentEntryId: "e-f1", next: 7_000, today: TODAY })).toEqual({
      ok: false,
      error: "The amount due cannot be less than the ₹8,000 already received.",
    });
    expect(db.tables.audit_event ?? []).toEqual([]);
  });

  it("puts the amount back when the audit event cannot be written, so the timeline never lies", async () => {
    const db = fakeDb(seed());
    db.failNext("audit_event", "insert failed");
    const result = await editAmountDue(db.client, LANDLORD, { rentEntryId: "e-4c", next: 15_000, today: TODAY });
    expect(result).toEqual({ ok: false, error: "Could not save. Your changes are still here — try again." });
    expect(db.tables.rent_entry.find((r) => r.id === "e-4c")?.amount_due).toBe(18_000);
  });
});

describe("logCall: a logged call is a message row with method call (L05-BTN-LOGCALL, D-17)", () => {
  it("inserts kind call, channel call, no body, with outcome and note", async () => {
    const db = fakeDb(seed());
    const result = await logCall(db.client, LANDLORD, { rentEntryId: "e-4c", outcome: "promised_to_pay", note: "Will pay Friday" });
    expect(result).toEqual({ ok: true });
    expect(db.tables.message).toEqual([
      expect.objectContaining({
        landlord_id: LANDLORD,
        kind: "call",
        channel: "call",
        rent_entry_id: "e-4c",
        tenancy_id: "t-4c",
        body: null,
        level: null,
        call_outcome: "promised_to_pay",
        call_note: "Will pay Friday",
      }),
    ]);
  });

  it("refuses an outcome outside the four options", async () => {
    const db = fakeDb(seed());
    const result = await logCall(db.client, LANDLORD, { rentEntryId: "e-4c", outcome: "angry", note: "" });
    expect(result).toEqual({ ok: false, error: "Choose how the call went." });
    expect(db.tables.message ?? []).toEqual([]);
  });

  it("stores an empty note as null", async () => {
    const db = fakeDb(seed());
    await logCall(db.client, LANDLORD, { rentEntryId: "e-4c", outcome: "no_answer", note: "   " });
    expect(db.tables.message?.[0].call_note).toBeNull();
  });
});
