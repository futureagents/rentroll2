import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  allowedMime,
  cleanFileName,
  isOwnStoragePath,
  isUuid,
  MAX_UPLOAD_BYTES,
  storagePathFor,
  uploadProblem,
  type TenancyDocumentType,
} from "@/app/(landlord)/units/_lib/files";

// Storage for L09-FRM-ADDTENANT, L09-TAB-PHOTOS † and L11-SEC-DOCS † (D-15, D-39). The bucket has
// no storage policies (schema §8): neither anon nor a signed-in landlord can touch a file
// directly. The service-role client used here does three things only, each for a path inside the
// signed-in landlord's own folder: sign a one-time upload URL, read back what was stored, and sign
// short-lived read URLs for document rows the landlord's RLS client has already returned.

const BUCKET = "documents";
/** Read links last an hour: long enough to view or share, short enough not to linger (D-15). */
export const READ_URL_SECONDS = 60 * 60;

export interface StartedUpload {
  documentId: string;
  signedUrl: string;
}

/** Signs an upload for one new object at `<landlord_id>/<new document id>`. No row is written yet. */
export async function startUpload(
  admin: SupabaseClient,
  landlordId: string,
  input: { type: TenancyDocumentType; mime: string; size: number },
): Promise<{ ok: true; upload: StartedUpload } | { ok: false; error: string }> {
  const problem = uploadProblem(input.type, input.mime, input.size);
  if (problem) return { ok: false, error: problem };
  const documentId = randomUUID();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePathFor(landlordId, documentId));
  if (error || !data) return { ok: false, error: "Could not upload. Try again." };
  return { ok: true, upload: { documentId, signedUrl: data.signedUrl } };
}

export interface FinishedFile {
  documentId: string;
  type: TenancyDocumentType;
  fileName: string;
  /** E5 alternative text for photos. */
  alt: string | null;
}

export interface VerifiedFile {
  id: string;
  type: TenancyDocumentType;
  storage_path: string;
  file_name: string;
  mime: string;
  size_bytes: number;
  alt_text: string | null;
}

/**
 * Checks each finished upload against what storage actually holds — the landlord's own path, a
 * permitted type and size by the stored metadata, not by what the browser claimed — and returns
 * the document row values. Any file that fails makes the whole set fail.
 */
export async function verifyUploads(
  admin: SupabaseClient,
  landlordId: string,
  files: FinishedFile[],
): Promise<{ ok: true; files: VerifiedFile[] } | { ok: false; error: string }> {
  const verified: VerifiedFile[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (!isUuid(file.documentId) || seen.has(file.documentId)) return { ok: false, error: UPLOAD_MISSING };
    seen.add(file.documentId);
    const path = storagePathFor(landlordId, file.documentId);
    if (!isOwnStoragePath(landlordId, file.documentId, path)) return { ok: false, error: UPLOAD_MISSING };
    const { data, error } = await admin.storage.from(BUCKET).info(path);
    if (error || !data) return { ok: false, error: UPLOAD_MISSING };
    const mime = String(data.contentType ?? "");
    const size = Number(data.size ?? 0);
    if (!allowedMime(file.type).includes(mime) || size <= 0 || size > MAX_UPLOAD_BYTES) {
      await admin.storage.from(BUCKET).remove([path]);
      return { ok: false, error: "One of the files is not a supported photo or document." };
    }
    verified.push({
      id: file.documentId,
      type: file.type,
      storage_path: path,
      file_name: cleanFileName(file.fileName),
      mime,
      size_bytes: size,
      alt_text: file.alt?.trim().slice(0, 300) || null,
    });
  }
  return { ok: true, files: verified };
}

const UPLOAD_MISSING = "A photo or document did not finish uploading. Remove it and add it again.";

/** Removes stored objects after a failed save, so a rolled-back form leaves nothing behind. */
export async function removeObjects(admin: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths);
}

/**
 * Short-lived read URLs for document rows the caller fetched through the landlord's RLS client
 * (so only their own rows reach here, E4-7). Keyed by document id; a file that cannot be signed
 * is simply absent and the screen shows its name without a link.
 */
export async function readUrls(
  admin: SupabaseClient,
  documents: { id: string; storage_path: string; file_name: string }[],
  options: { download?: boolean } = {},
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (documents.length === 0) return urls;
  if (options.download) {
    await Promise.all(
      documents.map(async (d) => {
        const { data } = await admin.storage.from(BUCKET).createSignedUrl(d.storage_path, READ_URL_SECONDS, { download: d.file_name });
        if (data?.signedUrl) urls.set(d.id, data.signedUrl);
      }),
    );
    return urls;
  }
  const { data } = await admin.storage.from(BUCKET).createSignedUrls(
    documents.map((d) => d.storage_path),
    READ_URL_SECONDS,
  );
  const byPath = new Map(documents.map((d) => [d.storage_path, d.id]));
  for (const item of data ?? []) {
    const id = item.path ? byPath.get(item.path) : undefined;
    if (id && item.signedUrl) urls.set(id, item.signedUrl);
  }
  return urls;
}
