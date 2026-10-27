// /dev/upload test files, made in the browser on demand. The pictures are a stand-in "photo"
// (wall, tiled floor, an arrow that must point up, the word TOP at the top) so a sideways or
// upside-down result is obvious. The colours are pixel content of a fake photo, not UI styling.
import { HEIC_SAMPLE_BASE64 } from "./heic-sample";
import { withOrientation } from "@/components/upload/orientation";

function drawScene(context: CanvasRenderingContext2D, width: number, height: number, caption: string) {
  const wall = context.createLinearGradient(0, 0, 0, height * 0.65);
  wall.addColorStop(0, "lightsteelblue");
  wall.addColorStop(1, "steelblue");
  context.fillStyle = wall;
  context.fillRect(0, 0, width, height * 0.65);
  context.fillStyle = "peru";
  context.fillRect(0, height * 0.65, width, height * 0.35);
  context.fillStyle = "saddlebrown";
  for (let x = 0; x < width; x += width / 8) context.fillRect(x, height * 0.65, Math.max(2, width / 300), height * 0.35);
  // The arrow
  const cx = width / 2;
  const unit = Math.min(width, height) / 10;
  context.fillStyle = "firebrick";
  context.beginPath();
  context.moveTo(cx, unit * 2);
  context.lineTo(cx + unit * 1.6, unit * 4);
  context.lineTo(cx - unit * 1.6, unit * 4);
  context.closePath();
  context.fill();
  context.fillRect(cx - unit * 0.5, unit * 4, unit, height * 0.75 - unit * 4);
  context.fillStyle = "white";
  context.font = `bold ${Math.round(unit * 0.9)}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.fillText("TOP", cx, unit * 1.3);
  context.font = `${Math.round(unit * 0.45)}px system-ui, sans-serif`;
  context.fillText(caption, cx, height - unit * 0.6);
}

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");
  return [canvas, context];
}

const jpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", quality));

/**
 * A portrait photo stored the way a phone held upright stores it: pixels turned 90° to the left
 * and EXIF Orientation 6 ("turn 90° right to view"). Shown without reading EXIF, it lies sideways.
 */
export async function rotatedPhoto(): Promise<File> {
  const uprightWidth = 900;
  const uprightHeight = 1200;
  const [canvas, context] = canvasOf(uprightHeight, uprightWidth); // stored landscape
  context.setTransform(0, -1, 1, 0, 0, uprightWidth);
  drawScene(context, uprightWidth, uprightHeight, "EXIF orientation 6");
  const tagged = await withOrientation(await jpeg(canvas, 0.9), 6);
  return new File([tagged], "IMG_rotated.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

/** Over the 10 MB limit (decisions §9): a real JPEG padded past its end marker, so it still shows. */
export async function oversizedPhoto(): Promise<File> {
  const [canvas, context] = canvasOf(1600, 1200);
  drawScene(context, 1600, 1200, "11 MB");
  const picture = await jpeg(canvas, 0.9);
  const padding = new Uint8Array(11 * 1024 * 1024 - picture.size);
  return new File([picture, padding], "IMG_oversized.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

/** A 12 MP camera-sized JPEG, grainy like a phone photo in a dim bathroom: several MB as picked. */
export async function cameraPhoto(): Promise<File> {
  const width = 4000;
  const height = 3000;
  const [canvas, context] = canvasOf(width, height);
  drawScene(context, width, height, "12 MP camera photo");
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  let seed = 7;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const grain = (seed % 41) - 20;
    data[i] += grain;
    data[i + 1] += grain;
    data[i + 2] += grain;
  }
  context.putImageData(image, 0, 0);
  let blob = await jpeg(canvas, 0.92);
  if (blob.size > 9.5 * 1024 * 1024) blob = await jpeg(canvas, 0.85);
  canvas.width = 0;
  return new File([blob], "IMG_20261027_camera.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

/** An iPhone-style HEIC. */
export function heicPhoto(): File {
  const bytes = Uint8Array.from(atob(HEIC_SAMPLE_BASE64), (c) => c.charCodeAt(0));
  return new File([bytes], "IMG_0412.HEIC", { type: "image/heic", lastModified: Date.now() });
}
