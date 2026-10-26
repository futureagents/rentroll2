// L-07 drafts. The privacy rule (L-07, D-27, D-37, G-2): a system-written tenant update is
// built from status and category only — never cost, vendor, or vendor rate. A cost may leave the
// system only inside a message the landlord composes and sends: the payment request (D-27).
import { describe, expect, it } from "vitest";

import {
  UPI_NOTE_MAX,
  buildPaymentLink,
  dispatchAddress,
  mapsLink,
  paymentRequestDraft,
  repairPaymentNote,
  tenantUpdateDraft,
  vendorDispatchDraft,
  type TenantUpdateInput,
} from "../../src/app/(landlord)/maintenance/_lib/drafts";
import { CATEGORIES, REQUEST_STATUSES } from "../../src/app/(landlord)/maintenance/_lib/model";

describe("tenant update draft (L07-BTN-UPDATETENANT)", () => {
  it("never contains a cost, a rupee sign, a vendor or a phone, even when handed them", () => {
    const leaky = {
      status: "done",
      category: "plumbing",
      cost: 1850,
      vendorName: "Ramesh Electricals",
      vendorPhone: "+919000000123",
      vendorRate: 450,
      note: "vendor overcharged",
    } as unknown as TenantUpdateInput;
    const draft = tenantUpdateDraft(leaky);
    expect(draft).not.toMatch(/₹|\d/);
    expect(draft).not.toContain("Ramesh");
    expect(draft).not.toContain("overcharged");
  });

  it("depends on status and category alone", () => {
    for (const status of REQUEST_STATUSES) {
      for (const category of CATEGORIES) {
        const draft = tenantUpdateDraft({ status, category });
        expect(draft).toBe(tenantUpdateDraft({ ...{ status, category }, ...({ cost: 9999 } as object) } as TenantUpdateInput));
        expect(draft).not.toMatch(/₹|\d/);
      }
    }
  });

  it("names the category and the status", () => {
    expect(tenantUpdateDraft({ status: "in_progress", category: "electrical" })).toBe(
      "Hello, an update on the electrical problem you reported: the work is in progress.",
    );
    expect(tenantUpdateDraft({ status: "done", category: "other" })).toContain("the problem you reported");
  });
});

describe("vendor dispatch draft (L07-BTN-DISPATCH, D-34)", () => {
  const input = {
    vendorName: "Ramesh Electricals",
    category: "electrical" as const,
    description: "Ceiling fan is slow",
    unitNumber: "3A",
    propertyName: "Kulkarni Apartments",
    propertyAddress: "12 FC Road, Pune",
    tenantPhone: "+919000000101",
    tenantName: "Asha Rao",
  };

  it("has the problem, the unit-prefixed property address, the tenant's phone and a Maps link", () => {
    const draft = vendorDispatchDraft(input);
    expect(draft).toContain("Hello Ramesh,");
    expect(draft).toContain("Problem: Ceiling fan is slow");
    expect(draft).toContain("Address: Flat 3A, Kulkarni Apartments, 12 FC Road, Pune");
    expect(draft).toContain("Tenant: Asha Rao, +91 90000 00101");
    expect(draft).toContain(mapsLink("Kulkarni Apartments", "12 FC Road, Pune"));
  });

  it("leaves out the tenant line for a vacant unit", () => {
    expect(vendorDispatchDraft({ ...input, tenantPhone: null, tenantName: null })).not.toContain("Tenant:");
  });

  it("builds the D-34 address and an encoded Maps search", () => {
    expect(dispatchAddress("2A", "Kulkarni Apartments", "12 FC Road")).toBe("Flat 2A, Kulkarni Apartments, 12 FC Road");
    expect(mapsLink("A & B", "Road 1")).toBe("https://www.google.com/maps/search/?api=1&query=A%20%26%20B%2C%20Road%201");
  });
});

describe("payment request (L07-CHK-TENANTLIABLE → S-02, D-27)", () => {
  it("is a plain UPI intent URL carrying the amount the landlord set", () => {
    const link = buildPaymentLink({
      upiId: "anil.kulkarni@okdemo",
      payeeName: "Kulkarni Properties",
      amount: 1200,
      note: repairPaymentNote("structural", "4C"),
    });
    expect(link.startsWith("upi://pay?")).toBe(true);
    const params = new URLSearchParams(link.slice("upi://pay?".length));
    expect(params.get("pa")).toBe("anil.kulkarni@okdemo");
    expect(params.get("pn")).toBe("Kulkarni Properties");
    expect(params.get("am")).toBe("1200");
    expect(params.get("tn")).toBe("Repair — Structural — Flat 4C");
    expect(params.get("cu")).toBe("INR");
    expect(link).not.toContain("+");
  });

  it("caps the note at the UPI limit", () => {
    const long = repairPaymentNote("electrical", "A-very-long-unit-number-that-goes-on-and-on");
    expect(Array.from(long).length).toBe(UPI_NOTE_MAX);
    const link = buildPaymentLink({ upiId: "a@b", payeeName: "X", amount: 1, note: "n".repeat(80) });
    expect(new URLSearchParams(link.split("?")[1]).get("tn")).toHaveLength(UPI_NOTE_MAX);
  });

  it("states the landlord's amount in Indian rupee format in the message the landlord sends", () => {
    expect(paymentRequestDraft("structural", 186000, "upi://pay?x")).toContain("₹1,86,000");
  });
});
