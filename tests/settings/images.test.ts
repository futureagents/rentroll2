// L15-UPL-LOGO and L15-UPL-SIGNATURE † storage checks (D-15, D-56). The service-role client signs
// and reads back objects only in the signed-in landlord's own folder; these are the refusals that
// keep it there: a document that already has a row is never re-attached, a signature is PNG or
// JPEG only, and a read URL is signed only for the landlord's own image of the asked kind (E4-7).
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";

import { UPLOAD_MESSAGES } from "../../src/components/upload/limits";
import {
  IMAGE_UPLOAD_MISSING,
  imageReadUrl,
  startImageUpload,
  verifyImageUpload,
} from "../../src/server/settings/images";

const L = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DOC = "33333333-3333-4333-8333-333333333333";

/** The landlord's RLS client: `document` rows it can see. */
function fakeDb(rows: { id: string; storage_path: string; type: string }[]) {
  const query = {
    select: () => query,
    or: async (filter: string) => ({ data: rows.filter((r) => filter.includes(r.id) || filter.includes(r.storage_path)), error: null }),
    eq: (_column: string, id: string) => ({ maybeSingle: async () => ({ data: rows.find((r) => r.id === id) ?? null }) }),
  };
  return { from: () => query } as unknown as SupabaseClient;
}

/** The service-role client: storage only, recording every path it touches. */
function fakeAdmin(objects: Record<string, { contentType: string; size: number }>) {
  const touched: string[] = [];
  const bucket = {
    info: async (path: string) => {
      touched.push(path);
      return objects[path] ? { data: objects[path], error: null } : { data: null, error: { message: "not found" } };
    },
    createSignedUrl: async (path: string) => {
      touched.push(path);
      return { data: { signedUrl: `https://signed.example/${path}` } };
    },
    createSignedUploadUrl: async (path: string) => {
      touched.push(path);
      return { data: { signedUrl: `https://upload.example/${path}` }, error: null };
    },
  };
  return { admin: { storage: { from: () => bucket } } as unknown as SupabaseClient, touched };
}

describe("verifyImageUpload", () => {
  it("accepts a fresh object in the landlord's own folder", async () => {
    const { admin, touched } = fakeAdmin({ [`${L}/${DOC}`]: { contentType: "image/jpeg", size: 1000 } });
    const result = await verifyImageUpload(fakeDb([]), admin, L, "signature", DOC, "sig.jpg");
    expect(result).toEqual({
      ok: true,
      row: { id: DOC, storage_path: `${L}/${DOC}`, file_name: "sig.jpg", mime: "image/jpeg", size_bytes: 1000 },
    });
    expect(touched).toEqual([`${L}/${DOC}`]);
  });

  it("never re-attaches a document that already has a row", async () => {
    const { admin, touched } = fakeAdmin({ [`${L}/${DOC}`]: { contentType: "image/jpeg", size: 1000 } });
    const db = fakeDb([{ id: DOC, storage_path: `${L}/${DOC}`, type: "logo" }]);
    expect(await verifyImageUpload(db, admin, L, "signature", DOC, "x")).toEqual({ ok: false, error: IMAGE_UPLOAD_MISSING.signature });
    expect(touched).toEqual([]); // refused before storage is read
  });

  it("refuses an id that is not a bare uuid, so no path outside the landlord's folder is read", async () => {
    const { admin, touched } = fakeAdmin({});
    for (const id of [`../${OTHER}/${DOC}`, `${DOC}/x`, ""]) {
      expect(await verifyImageUpload(fakeDb([]), admin, L, "logo", id, "x")).toEqual({ ok: false, error: IMAGE_UPLOAD_MISSING.logo });
    }
    expect(touched).toEqual([]);
  });

  it("takes the type from storage, not the browser: a signature is PNG or JPEG only (D-56)", async () => {
    const { admin } = fakeAdmin({ [`${L}/${DOC}`]: { contentType: "image/webp", size: 1000 } });
    expect(await verifyImageUpload(fakeDb([]), admin, L, "signature", DOC, "x")).toEqual({ ok: false, error: UPLOAD_MESSAGES.notSupported });
    expect((await verifyImageUpload(fakeDb([]), admin, L, "logo", DOC, "x")).ok).toBe(true);
  });
});

describe("startImageUpload", () => {
  it("signs only a new object in the landlord's own folder, and refuses a WebP signature", async () => {
    const { admin, touched } = fakeAdmin({});
    const signed = await startImageUpload(admin, L, "signature", { mime: "image/png", size: 1000 });
    expect(signed.ok && signed.ref).toMatch(/^[0-9a-f-]{36}$/);
    expect(touched).toEqual([`${L}/${signed.ok ? signed.ref : ""}`]);
    expect(await startImageUpload(admin, L, "signature", { mime: "image/webp", size: 1000 })).toEqual({
      ok: false,
      error: UPLOAD_MESSAGES.notSupported,
    });
  });
});

describe("imageReadUrl", () => {
  it("signs the landlord's own image of the asked kind", async () => {
    const { admin, touched } = fakeAdmin({});
    const db = fakeDb([{ id: DOC, storage_path: `${L}/${DOC}`, type: "signature" }]);
    expect(await imageReadUrl(db, admin, L, "signature", DOC)).toBe(`https://signed.example/${L}/${DOC}`);
    expect(touched).toEqual([`${L}/${DOC}`]);
  });

  it("refuses a document of another kind: the logo slot never signs a signature, nor the reverse", async () => {
    const { admin, touched } = fakeAdmin({});
    const db = fakeDb([{ id: DOC, storage_path: `${L}/${DOC}`, type: "signature" }]);
    expect(await imageReadUrl(db, admin, L, "logo", DOC)).toBeNull();
    expect(touched).toEqual([]);
  });

  it("refuses a document outside the landlord's folder, and an id RLS does not return", async () => {
    const { admin, touched } = fakeAdmin({});
    const db = fakeDb([{ id: DOC, storage_path: `${OTHER}/${DOC}`, type: "signature" }]);
    expect(await imageReadUrl(db, admin, L, "signature", DOC)).toBeNull();
    expect(await imageReadUrl(fakeDb([]), admin, L, "signature", DOC)).toBeNull();
    expect(await imageReadUrl(db, admin, L, "signature", null)).toBeNull();
    expect(touched).toEqual([]);
  });
});
