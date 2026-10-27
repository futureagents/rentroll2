// S-04 · EXIF orientation. A phone held upright usually stores the pixels sideways and writes
// an EXIF Orientation tag saying how to turn them. Current browsers honour the tag when they
// decode; older ones (and some WebViews) do not, and a sideways photo of a leak is useless. So
// the uploader checks once whether this browser's decode turns the photo, and turns it by hand
// when it does not. Re-encoding through a canvas then drops all EXIF, including GPS location.

/** EXIF Orientation 1–8; 1 is "as stored". Reads only a JPEG's APP1 segment. */
export function readOrientation(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return 1;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) return 1; // start of scan: no more headers
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1 && isExifHeader(bytes, offset + 4)) {
      const tiff = offset + 10;
      if (tiff + 8 > bytes.length) return 1;
      const little = bytes[tiff] === 0x49;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > bytes.length) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > bytes.length) return 1;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    offset += 2 + size;
  }
  return 1;
}

function isExifHeader(bytes: Uint8Array, at: number): boolean {
  return [0x45, 0x78, 0x69, 0x66, 0, 0].every((value, i) => bytes[at + i] === value); // "Exif\0\0"
}

/** Orientations 5–8 swap width and height. */
export function swapsAxes(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

/**
 * Canvas transform that draws a `width`×`height` source upright. The canvas must already be
 * sized `height`×`width` for orientations 5–8.
 */
export function orientationTransform(
  orientation: number,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2: return [-1, 0, 0, 1, width, 0];
    case 3: return [-1, 0, 0, -1, width, height];
    case 4: return [1, 0, 0, -1, 0, height];
    case 5: return [0, 1, 1, 0, 0, 0];
    case 6: return [0, 1, -1, 0, height, 0];
    case 7: return [0, -1, -1, 0, height, width];
    case 8: return [0, -1, 1, 0, 0, width];
    default: return [1, 0, 0, 1, 0, 0];
  }
}

/**
 * Returns a copy of a JPEG carrying the given EXIF Orientation tag. Used to probe the browser
 * below, and by /dev/upload to make a "photo taken holding the phone upright".
 */
export async function withOrientation(jpeg: Blob, orientation: number): Promise<Blob> {
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  // APP1 · "Exif\0\0" · big-endian TIFF header · IFD0 with one SHORT entry (0x0112) · no next IFD.
  const app1 = new Uint8Array([
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
  // After SOI and, when present, the JFIF APP0 segment, which must stay first.
  let at = 2;
  if (bytes[2] === 0xff && bytes[3] === 0xe0) at = 4 + ((bytes[4] << 8) | bytes[5]);
  return new Blob([bytes.slice(0, at), app1, bytes.slice(at)], { type: "image/jpeg" });
}

let probe: Promise<boolean> | null = null;

/** True when `createImageBitmap(file, { imageOrientation: "from-image" })` turns the pixels. */
export function decodeAppliesOrientation(): Promise<boolean> {
  probe ??= (async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 1;
      canvas.getContext("2d")?.fillRect(0, 0, 2, 1);
      const plain = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg"));
      if (!plain) return true;
      const bitmap = await createImageBitmap(await withOrientation(plain, 6), { imageOrientation: "from-image" });
      const turned = bitmap.width === 1 && bitmap.height === 2;
      bitmap.close();
      return turned;
    } catch {
      return true; // nothing to learn; trust the browser
    }
  })();
  return probe;
}
