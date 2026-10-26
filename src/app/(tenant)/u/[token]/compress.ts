// PROMOTE: S-04 on-device compression → part of the A2 PhotoUploader (S-04 row), which today
// leaves compression to the lane. Local to T-01 until S-04 owns it.
//
// S-04: "Images are compressed on the device before upload. A 6MB phone photo should leave as
// roughly 400KB." Long edge capped at 1600px, JPEG, quality stepped down until it fits. A file the
// browser cannot decode (HEIC outside Safari) is sent as it is if it is already small enough.
import { MAX_ORIGINAL_BYTES, MAX_PHOTO_BYTES, PHOTO_MESSAGES } from "@/lib/tenant/photos";

const LONG_EDGE = 1600;
const TARGET_BYTES = 450 * 1024;
const QUALITIES = [0.82, 0.72, 0.62, 0.52];
const PASSTHROUGH_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type Compressed = { ok: true; blob: Blob } | { ok: false; message: string };

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function reencode(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of QUALITIES) {
      blob = await toBlob(canvas, quality);
      if (blob && blob.size <= TARGET_BYTES) break;
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function compressPhoto(file: File): Promise<Compressed> {
  if (file.size > MAX_ORIGINAL_BYTES) return { ok: false, message: PHOTO_MESSAGES.size };
  if (!file.type.startsWith("image/")) return { ok: false, message: PHOTO_MESSAGES.type };
  try {
    const blob = await reencode(file);
    if (blob && blob.size <= MAX_PHOTO_BYTES) return { ok: true, blob };
  } catch {
    // Not decodable here; fall through to sending the original.
  }
  if (!PASSTHROUGH_TYPES.includes(file.type)) return { ok: false, message: PHOTO_MESSAGES.type };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: PHOTO_MESSAGES.size };
  return { ok: true, blob: file };
}
