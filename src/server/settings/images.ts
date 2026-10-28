import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_ORIGINAL_BYTES, UPLOAD_MESSAGES } from "@/components/upload/limits";
import type { SignedUpload } from "@/components/upload/transport";
import type { ImageKind } from "@/lib/settings";

// L15-UPL-LOGO (D-15) and L15-UPL-SIGNATURE † (D-56) storage. The `documents` bucket has no
// storage policies (schema §8), so a signed-in landlord cannot touch a file directly. The
// service-role client `admin` does exactly two things here, each for one object inside the
// signed-in landlord's own folder:
//   1. sign a one-time upload URL for `<landlord_id>/<new document id>` (startImageUpload);
//   2. read the stored object back: its metadata to verify an upload (verifyImageUpload) and a
//      short-lived read URL for landlord pages that show or print it (imageReadUrl).
// Every `document` and `landlord` write goes through the landlord's RLS client `db`.
//
// D-56: the signature is read only by landlord server code (L-15, landlord-printed P-01 and
// P-02). D-30 never lists `signature_document_id`, and tests/tenant/d56-signature.test.ts fails
// if tenant code names it or imports src/server/settings.

const BUCKET = "documents";
/** S-04 sends the compressed copy, which is a JPEG; the original PNG/WebP is accepted as well. */
const ALLOWED_MIME: Record<ImageKind, readonly string[]> = {
  logo: ["image/jpeg", "image/png", "image/webp"],
  signature: ["image/jpeg", "image/png"], // D-56: PNG or JPEG
};
/** Long enough to look at the page or print it, short enough not to linger (D-15). */
export const IMAGE_URL_SECONDS = 10 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pathFor = (landlordId: string, documentId: string) => `${landlordId}/${documentId}`;

export const IMAGE_UPLOAD_MISSING: Record<ImageKind, string> = {
  logo: "The logo did not finish uploading. Remove it and add it again.",
  signature: "The signature did not finish uploading. Remove it and add it again.",
};

function uploadProblem(kind: ImageKind, mime: string, size: number): string | null {
  if (!ALLOWED_MIME[kind].includes(mime)) return UPLOAD_MESSAGES.notSupported;
  if (size <= 0 || size > MAX_ORIGINAL_BYTES) return UPLOAD_MESSAGES.tooLarge;
  return null;
}

/** S-04 signer: the ref handed back is the new document id; no row is written yet. */
export async function startImageUpload(
  admin: SupabaseClient,
  landlordId: string,
  kind: ImageKind,
  file: { mime: string; size: number },
): Promise<SignedUpload> {
  const problem = uploadProblem(kind, file.mime, file.size);
  if (problem) return { ok: false, error: problem };
  const documentId = randomUUID();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(pathFor(landlordId, documentId));
  if (error || !data) return { ok: false, error: UPLOAD_MESSAGES.failed };
  return { ok: true, signedUrl: data.signedUrl, ref: documentId };
}

export interface VerifiedImage {
  id: string;
  storage_path: string;
  file_name: string;
  mime: string;
  size_bytes: number;
}

/**
 * Accepts a finished upload only if it is a fresh object in the landlord's own folder, of an
 * allowed type and size by what storage holds (not by what the browser claimed). An id that
 * already has a `document` row is refused, so no existing file — a logo, a statement, another
 * image — can be re-attached as the logo or the signature.
 */
export async function verifyImageUpload(
  db: SupabaseClient,
  admin: SupabaseClient,
  landlordId: string,
  kind: ImageKind,
  documentId: string,
  fileName: string,
): Promise<{ ok: true; row: VerifiedImage } | { ok: false; error: string }> {
  const missing = IMAGE_UPLOAD_MISSING[kind];
  if (!UUID.test(landlordId) || !UUID.test(documentId)) return { ok: false, error: missing };
  const path = pathFor(landlordId, documentId);

  const { data: existing, error: existingError } = await db
    .from("document")
    .select("id")
    .or(`id.eq.${documentId},storage_path.eq.${path}`);
  if (existingError || (existing ?? []).length > 0) return { ok: false, error: missing };

  const { data: info, error } = await admin.storage.from(BUCKET).info(path);
  if (error || !info) return { ok: false, error: missing };
  const mime = String(info.contentType ?? "");
  const size = Number(info.size ?? 0);
  const problem = uploadProblem(kind, mime, size);
  if (problem) return { ok: false, error: problem };

  const base = (fileName.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return { ok: true, row: { id: documentId, storage_path: path, file_name: (base || kind).slice(0, 120), mime, size_bytes: size } };
}

/**
 * A short-lived read URL for the landlord's saved logo or signature. `documentId` comes from the
 * landlord's own row; the `document` row is read through RLS first and must be of `kind` and in
 * the landlord's own folder, so only their own image is ever signed (E4-7).
 */
export async function imageReadUrl(
  db: SupabaseClient,
  admin: SupabaseClient,
  landlordId: string,
  kind: ImageKind,
  documentId: string | null,
): Promise<string | null> {
  if (!documentId) return null;
  const { data: doc } = await db
    .from("document")
    .select("storage_path, type")
    .eq("id", documentId)
    .maybeSingle<{ storage_path: string; type: string }>();
  if (!doc || doc.type !== kind || !doc.storage_path.startsWith(`${landlordId}/`)) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(doc.storage_path, IMAGE_URL_SECONDS);
  return data?.signedUrl ?? null;
}
