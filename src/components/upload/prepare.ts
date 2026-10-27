// S-04 · on-device preparation, before any upload starts: check the file, decode it (HEIC
// included), stand it upright, shrink it and re-encode it as a JPEG of roughly 400KB.
//
// "Images are compressed on the device before upload. A 6MB phone photo should leave as roughly
// 400KB." Everything here runs in the browser; the original never leaves the phone.
import {
  FALLBACK_EDGE_PX,
  LONG_EDGE_PX,
  MAX_ORIGINAL_BYTES,
  TARGET_BYTES,
  UPLOAD_MESSAGES,
} from "./limits";
import { decodeAppliesOrientation, orientationTransform, readOrientation, swapsAxes } from "./orientation";

export type PhotoKind = "jpeg" | "png" | "webp" | "heic";

export type Prepared =
  | { ok: true; blob: Blob; width: number; height: number }
  | { ok: false; error: string; retryable: boolean };

const QUALITIES = [0.82, 0.74, 0.66, 0.58];
const HEAD_BYTES = 128 * 1024; // EXIF sits in the first segments of a JPEG
const HEIC_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"];

const ascii = (bytes: Uint8Array, at: number, text: string) =>
  [...text].every((c, i) => bytes[at + i] === c.charCodeAt(0));

/** The file's real type from its first bytes. The name and the browser's claimed type are ignored. */
export function sniffKind(head: Uint8Array): PhotoKind | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head[0] === 0x89 && ascii(head, 1, "PNG")) return "png";
  if (ascii(head, 0, "RIFF") && ascii(head, 8, "WEBP")) return "webp";
  if (ascii(head, 4, "ftyp") && HEIC_BRANDS.some((brand) => ascii(head, 8, brand))) return "heic";
  return null;
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** EXIF orientation still to apply; 1 when the decoder already turned the pixels. */
  orientation: number;
  close: () => void;
}

class RetryableError extends Error {}

function fromBitmap(bitmap: ImageBitmap, orientation = 1): Decoded {
  return { source: bitmap, width: bitmap.width, height: bitmap.height, orientation, close: () => bitmap.close() };
}

/** Fallback for browsers whose createImageBitmap refuses a Blob. <img> honours EXIF by default. */
async function viaImageElement(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, orientation: 1, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeHeic(file: File): Promise<Decoded> {
  try {
    return fromBitmap(await createImageBitmap(file)); // Safari decodes HEIC itself
  } catch {
    // Chrome and Firefox cannot: fall through to libheif, fetched only when a HEIC turns up.
  }
  let heicTo: typeof import("heic-to/next").heicTo;
  try {
    ({ heicTo } = await import("heic-to/next"));
  } catch {
    throw new RetryableError("decoder did not load"); // a weak connection; Retry fetches it again
  }
  return fromBitmap(await heicTo({ blob: file, type: "bitmap" }));
}

async function decode(file: File, kind: PhotoKind, head: Uint8Array): Promise<Decoded> {
  if (kind === "heic") return decodeHeic(file);
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const pending = kind === "jpeg" && !(await decodeAppliesOrientation()) ? readOrientation(head) : 1;
    return fromBitmap(bitmap, pending);
  } catch {
    return viaImageElement(file);
  }
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    const offscreen = new OffscreenCanvas(width, height);
    if (offscreen.getContext("2d")) return offscreen;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toJpeg(canvas: AnyCanvas, quality: number): Promise<Blob | null> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function encode(decoded: Decoded, edge: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, edge / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const [canvasWidth, canvasHeight] = swapsAxes(decoded.orientation) ? [height, width] : [width, height];
  const canvas = makeCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error("no 2d context");
  context.fillStyle = "white"; // a transparent PNG becomes a JPEG on white, not black
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.setTransform(...orientationTransform(decoded.orientation, width, height));
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded.source, 0, 0, width, height);
  let blob: Blob | null = null;
  for (const quality of QUALITIES) {
    blob = await toJpeg(canvas, quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  canvas.width = 0; // release the pixels now, not at the next collection
  canvas.height = 0;
  if (!blob) throw new Error("encode failed");
  return { blob, width: canvasWidth, height: canvasHeight };
}

/**
 * Checks, decodes and compresses one photo. Errors use the S04-ERR wording; `retryable` is false
 * when trying again cannot help (too large, not a photo).
 */
export async function preparePhoto(file: File): Promise<Prepared> {
  if (file.size > MAX_ORIGINAL_BYTES) return { ok: false, error: UPLOAD_MESSAGES.tooLarge, retryable: false };
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const kind = sniffKind(head);
  if (!kind) return { ok: false, error: UPLOAD_MESSAGES.notSupported, retryable: false };

  let decoded: Decoded;
  try {
    decoded = await decode(file, kind, head);
  } catch (error) {
    return error instanceof RetryableError
      ? { ok: false, error: UPLOAD_MESSAGES.failed, retryable: true }
      : { ok: false, error: UPLOAD_MESSAGES.notSupported, retryable: false };
  }
  try {
    let result = await encode(decoded, LONG_EDGE_PX);
    if (result.blob.size > TARGET_BYTES * 1.25) result = await encode(decoded, FALLBACK_EDGE_PX);
    return { ok: true, ...result };
  } catch {
    return { ok: false, error: UPLOAD_MESSAGES.notSupported, retryable: false };
  } finally {
    decoded.close();
  }
}
