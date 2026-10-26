// T-01 Components and Rules: what a report must contain before a request row may exist.
import { describe, expect, it } from "vitest";

import { checkPhoto, MAX_PHOTO_BYTES, PHOTO_MESSAGES } from "../../src/lib/tenant/photos";
import {
  CATEGORY_OPTIONS,
  FIELD_MESSAGES,
  firstInvalidField,
  URGENCY_OPTIONS,
  validateReport,
} from "../../src/lib/tenant/report";

const valid = {
  category: "plumbing",
  description: "Geyser is leaking from the bottom since yesterday.",
  urgency: "normal",
  name: "Priya Deshpande",
  phone: "9000000303",
};

describe("T01 options", () => {
  it("offers the seven T01-SEL-CATEGORY choices in order, 'other' labelled 'Something else' (D-33)", () => {
    expect(CATEGORY_OPTIONS).toEqual([
      { value: "plumbing", label: "Plumbing" },
      { value: "electrical", label: "Electrical" },
      { value: "appliance", label: "Appliance" },
      { value: "structural", label: "Structural" },
      { value: "pest", label: "Pest" },
      { value: "cleaning", label: "Cleaning" },
      { value: "other", label: "Something else" },
    ]);
  });

  it("offers Low · Normal · Urgent (T01-SEG-URGENCY)", () => {
    expect(URGENCY_OPTIONS.map((o) => o.label)).toEqual(["Low", "Normal", "Urgent"]);
  });
});

describe("validateReport", () => {
  it("accepts a complete report and normalises the phone to +91 and ten digits", () => {
    expect(validateReport(valid)).toEqual({
      ok: true,
      value: { ...valid, phone: "+919000000303" },
    });
  });

  it("requires a category and a description of at least 10 characters after trimming", () => {
    const result = validateReport({ ...valid, category: "", description: "  leaking  " });
    expect(result).toEqual({
      ok: false,
      errors: { category: FIELD_MESSAGES.category, description: FIELD_MESSAGES.description },
    });
  });

  it("accepts exactly 10 characters", () => {
    expect(validateReport({ ...valid, description: "  0123456789  " }).ok).toBe(true);
  });

  it("defaults urgency to Normal when none is sent (T01-SEG-URGENCY)", () => {
    const result = validateReport({ ...valid, urgency: "" });
    expect(result.ok && result.value.urgency).toBe("normal");
  });

  it("refuses values outside the enums rather than storing them", () => {
    const result = validateReport({ ...valid, category: "rent", urgency: "critical" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["category", "urgency"]);
  });

  it("lets name and phone be blank (a door-sticker report, D-02)", () => {
    expect(validateReport({ ...valid, name: "  ", phone: "" })).toEqual({
      ok: true,
      value: { ...valid, name: null, phone: null },
    });
  });

  it("accepts a phone typed with +91, spaces or dashes; refuses anything that is not ten digits", () => {
    for (const phone of ["+91 90000 00303", "90000-00303", "919000000303"]) {
      const result = validateReport({ ...valid, phone });
      expect(result.ok && result.value.phone).toBe("+919000000303");
    }
    for (const phone of ["12345", "90000003031", "abcdefghij"]) {
      const result = validateReport({ ...valid, phone });
      expect(result).toEqual({ ok: false, errors: { phone: FIELD_MESSAGES.phone } });
    }
  });

  it("caps description and name length", () => {
    expect(validateReport({ ...valid, description: "x".repeat(2001) }).ok).toBe(false);
    expect(validateReport({ ...valid, description: "x".repeat(2000) }).ok).toBe(true);
    expect(validateReport({ ...valid, name: "x".repeat(81) }).ok).toBe(false);
  });

  it("tolerates missing or non-string fields from a hand-built POST", () => {
    const result = validateReport({} as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["category", "description"]);
  });
});

describe("firstInvalidField: scroll target in reading order (T-01 Validation failure)", () => {
  it("returns the first field on the page that has an error", () => {
    expect(firstInvalidField({ phone: "x", description: "y" })).toBe("description");
    expect(firstInvalidField({ photos: "x", name: "y" })).toBe("photos");
    expect(firstInvalidField({})).toBeNull();
  });
});

describe("checkPhoto (S-04, server side)", () => {
  const bytes = (...head: number[]) => new Uint8Array([...head, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

  it("identifies JPEG, PNG, WebP and HEIC by their bytes, not by the name or the claimed type", () => {
    expect(checkPhoto(bytes(0xff, 0xd8, 0xff, 0xe0))).toMatchObject({ ok: true, mime: "image/jpeg", extension: "jpg" });
    expect(checkPhoto(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toMatchObject({ ok: true, mime: "image/png" });
    expect(checkPhoto(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))).toMatchObject({ ok: true, mime: "image/webp" });
    expect(checkPhoto(bytes(0, 0, 0, 0x18, ...ascii("ftypheic")))).toMatchObject({ ok: true, mime: "image/heic" });
  });

  it("refuses other types with the S04-ERR wording", () => {
    expect(checkPhoto(bytes(...ascii("GIF89a")))).toEqual({ ok: false, message: PHOTO_MESSAGES.type });
    expect(checkPhoto(bytes(...ascii("%PDF-1.7")))).toEqual({ ok: false, message: PHOTO_MESSAGES.type });
    expect(checkPhoto(new Uint8Array())).toEqual({ ok: false, message: PHOTO_MESSAGES.type });
  });

  it("refuses a file over the server cap", () => {
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(checkPhoto(big)).toEqual({ ok: false, message: PHOTO_MESSAGES.size });
  });
});
