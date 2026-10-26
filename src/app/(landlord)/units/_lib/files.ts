// Upload rules for move-in photos (S-04, landlord limit 10) and tenancy documents (agreement,
// ID proof) on L09-FRM-ADDTENANT, L09-TAB-PHOTOS † and L11-SEC-DOCS † (D-15, D-39).
//
// Files go to the private `documents` bucket at `<landlord_id>/<document_id>` (schema comment on
// document.storage_path). The browser never holds a storage credential: the server signs a
// one-time upload URL for that exact path, and only after the upload does the server check the
// stored object and write the `document` row. Reading is by short-lived signed URL, server-made.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // decisions §9: 10 MB before compression
export const MAX_LANDLORD_PHOTOS = 10; // S-04 rules

export const PHOTO_MIME = ["image/jpeg", "image/png", "image/heic", "image/webp"] as const;
export const DOCUMENT_MIME = [...PHOTO_MIME, "application/pdf"] as const;

/** The document types this lane writes. Other types belong to L-07, L-13 and L-15. */
export type TenancyDocumentType = "move_in_photo" | "agreement" | "id_proof";

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  agreement: "Agreement",
  id_proof: "ID proof",
  move_in_photo: "Move-in photo",
  move_out_photo: "Move-out photo",
  request_before_photo: "Repair photo (reported)",
  request_after_photo: "Repair photo (after)",
  deduction_photo: "Deduction photo",
  statement: "Settlement statement",
  logo: "Logo",
};

export function allowedMime(type: TenancyDocumentType): readonly string[] {
  return type === "move_in_photo" ? PHOTO_MIME : DOCUMENT_MIME;
}

/** S04-ERR wording, shown on the thumbnail. */
export const TOO_LARGE = "That file is too large";
export const NOT_SUPPORTED = "That file type is not supported";

export function uploadProblem(type: TenancyDocumentType, mime: string, size: number): string | null {
  if (!allowedMime(type).includes(mime)) return NOT_SUPPORTED;
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_UPLOAD_BYTES) return TOO_LARGE;
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Where a landlord's file lives. The document id doubles as the object name. */
export function storagePathFor(landlordId: string, documentId: string): string {
  return `${landlordId}/${documentId}`;
}

/**
 * The server accepts a finished upload only for a path it could have signed for this landlord:
 * their own folder and a bare document id. Nothing else — no `..`, no other landlord's folder.
 */
export function isOwnStoragePath(landlordId: string, documentId: string, path: string): boolean {
  return isUuid(landlordId) && isUuid(documentId) && path === storagePathFor(landlordId, documentId);
}

/** A file name safe to store and show back: no path, no control characters, at most 120 chars. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "file").slice(0, 120);
}

/** E5: photo thumbnails carry meaningful alternative text, never the file name. */
export function moveInPhotoAlt(unitLabel: string, tenantName: string, index: number): string {
  return `Move-in condition photo ${index + 1}, ${unitLabel}, ${tenantName}'s tenancy`;
}
