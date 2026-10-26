// S-04 limits for tenant photos, and the byte check the server applies to every file. Client-safe.
// The type is read from the file's own bytes; the name and the browser's claimed type are ignored.

/** S-04: "Maximum 3 photos on tenant screens". */
export const MAX_TENANT_PHOTOS = 3;
/** Before compression (decisions §9: 10 MB is a build constant). */
export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
/**
 * After compression, per file, enforced by the server. S-04 aims for roughly 400KB; the slack
 * covers a photo the device could not re-encode (HEIC on some browsers) that is already small.
 */
export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;

/** S04-ERR wording, plus the count rule. */
export const PHOTO_MESSAGES = {
  size: "That file is too large",
  type: "That file type is not supported",
  count: `You can add up to ${MAX_TENANT_PHOTOS} photos.`,
} as const;

export type PhotoMime = "image/jpeg" | "image/png" | "image/webp" | "image/heic";

export interface CheckedPhoto {
  bytes: Uint8Array;
  mime: PhotoMime;
  extension: "jpg" | "png" | "webp" | "heic";
}

const startsWith = (bytes: Uint8Array, at: number, expected: readonly number[]) =>
  expected.every((value, i) => bytes[at + i] === value);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function sniff(bytes: Uint8Array): Omit<CheckedPhoto, "bytes"> | null {
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", extension: "png" };
  if (startsWith(bytes, 0, ascii("RIFF")) && startsWith(bytes, 8, ascii("WEBP"))) return { mime: "image/webp", extension: "webp" };
  if (startsWith(bytes, 4, ascii("ftyp")) && ["heic", "heix", "mif1", "msf1"].some((brand) => startsWith(bytes, 8, ascii(brand)))) {
    return { mime: "image/heic", extension: "heic" };
  }
  return null;
}

export function checkPhoto(bytes: Uint8Array): ({ ok: true } & CheckedPhoto) | { ok: false; message: string } {
  const kind = sniff(bytes);
  if (!kind) return { ok: false, message: PHOTO_MESSAGES.type };
  if (bytes.byteLength > MAX_PHOTO_BYTES) return { ok: false, message: PHOTO_MESSAGES.size };
  return { ok: true, bytes, ...kind };
}
