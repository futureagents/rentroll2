import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_ORIGINAL_BYTES, UPLOAD_MESSAGES } from "@/components/upload/limits";
import type { SignedUpload } from "@/components/upload/transport";

// L15-UPL-LOGO storage (D-15). The `documents` bucket has no storage policies (schema §8), so a
// signed-in landlord cannot touch a file directly. The service-role client `admin` does exactly
// two things here, each for one object inside the signed-in landlord's own folder:
//   1. sign a one-time upload URL for `<landlord_id>/<new document id>` (startLogoUpload);
//   2. read the stored object back: its metadata to verify an upload (verifyLogoUpload) and a
//      short-lived read URL to show the saved logo on L-15 (logoPreviewUrl).
// Every `document` and `landlord` write goes through the landlord's RLS client `db`.

const BUCKET = "documents";
/** S-04 sends the compressed copy: JPEG from every source, or the original PNG/WebP. */
const LOGO_MIME = ["image/jpeg", "image/png", "image/webp"];
/** Long enough to look at the page, short enough not to linger (D-15). */
const PREVIEW_URL_SECONDS = 10 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pathFor = (landlordId: string, documentId: string) => `${landlordId}/${documentId}`;

export const LOGO_UPLOAD_MISSING = "The logo did not finish uploading. Remove it and add it again.";

function uploadProblem(mime: string, size: number): string | null {
  if (!LOGO_MIME.includes(mime)) return UPLOAD_MESSAGES.notSupported;
  if (size <= 0 || size > MAX_ORIGINAL_BYTES) return UPLOAD_MESSAGES.tooLarge;
  return null;
}

/** S-04 signer: the ref handed back is the new document id; no row is written yet. */
export async function startLogoUpload(
  admin: SupabaseClient,
  landlordId: string,
  file: { mime: string; size: number },
): Promise<SignedUpload> {
  const problem = uploadProblem(file.mime, file.size);
  if (problem) return { ok: false, error: problem };
  const documentId = randomUUID();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(pathFor(landlordId, documentId));
  if (error || !data) return { ok: false, error: UPLOAD_MESSAGES.failed };
  return { ok: true, signedUrl: data.signedUrl, ref: documentId };
}

export interface VerifiedLogo {
  id: string;
  storage_path: string;
  file_name: string;
  mime: string;
  size_bytes: number;
}

/**
 * Accepts a finished upload only if it is a fresh object in the landlord's own folder, of a logo
 * type and size by what storage holds (not by what the browser claimed). An id that already has a
 * `document` row is refused, so no existing file can be re-attached as the logo.
 */
export async function verifyLogoUpload(
  db: SupabaseClient,
  admin: SupabaseClient,
  landlordId: string,
  documentId: string,
  fileName: string,
): Promise<{ ok: true; row: VerifiedLogo } | { ok: false; error: string }> {
  if (!UUID.test(landlordId) || !UUID.test(documentId)) return { ok: false, error: LOGO_UPLOAD_MISSING };
  const path = pathFor(landlordId, documentId);

  const { data: existing, error: existingError } = await db
    .from("document")
    .select("id")
    .or(`id.eq.${documentId},storage_path.eq.${path}`);
  if (existingError || (existing ?? []).length > 0) return { ok: false, error: LOGO_UPLOAD_MISSING };

  const { data: info, error } = await admin.storage.from(BUCKET).info(path);
  if (error || !info) return { ok: false, error: LOGO_UPLOAD_MISSING };
  const mime = String(info.contentType ?? "");
  const size = Number(info.size ?? 0);
  const problem = uploadProblem(mime, size);
  if (problem) return { ok: false, error: problem };

  const base = (fileName.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return { ok: true, row: { id: documentId, storage_path: path, file_name: (base || "logo").slice(0, 120), mime, size_bytes: size } };
}

/**
 * A short-lived read URL for the saved logo. `documentId` comes from the landlord's own row; the
 * `document` row is read through RLS first, so only the landlord's own logo is ever signed (E4-7).
 */
export async function logoPreviewUrl(
  db: SupabaseClient,
  admin: SupabaseClient,
  landlordId: string,
  documentId: string | null,
): Promise<string | null> {
  if (!documentId) return null;
  const { data: doc } = await db
    .from("document")
    .select("storage_path, type")
    .eq("id", documentId)
    .maybeSingle<{ storage_path: string; type: string }>();
  if (!doc || doc.type !== "logo" || !doc.storage_path.startsWith(`${landlordId}/`)) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(doc.storage_path, PREVIEW_URL_SECONDS);
  return data?.signedUrl ?? null;
}
