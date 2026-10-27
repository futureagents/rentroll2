"use client";
// S02-IMG-QR and S02-BTN-DOWNLOADQR. Inline SVG on screen (sharp at any size, no image request
// that could arrive broken); a PNG drawn from the same modules for the download, because a PNG is
// what WhatsApp and the photo gallery accept.
// PROMOTE: QR code — merge with src/app/print/_lib/qr-svg.tsx (P-01, P-03) into one shared QR
// component (A2 display components) that takes a size in px or mm and offers a PNG export.
import qrcode from "qrcode-generator";

/** Quiet zone, in modules, on each side (the QR standard asks for 4). */
const QUIET = 4;

interface QrMatrix {
  count: number;
  isDark: (row: number, col: number) => boolean;
}

/** The QR modules for `value`, or null if it cannot be encoded (far too long). */
export function qrMatrix(value: string): QrMatrix | null {
  try {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    return { count: qr.getModuleCount(), isDark: (r, c) => qr.isDark(r, c) };
  } catch {
    return null;
  }
}

export function PaymentQr({ matrix, label }: { matrix: QrMatrix; label: string }) {
  const total = matrix.count + QUIET * 2;
  let path = "";
  for (let row = 0; row < matrix.count; row++) {
    for (let col = 0; col < matrix.count; col++) {
      if (matrix.isDark(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className="aspect-square w-full"
    >
      <rect width={total} height={total} className="fill-surface" />
      <path d={path} className="fill-ink" />
    </svg>
  );
}

/** Pixels per module in the downloaded PNG: ~400px for a typical UPI link. */
const PNG_SCALE = 10;

/**
 * Saves the QR as a PNG. Colours come from the A1 tokens at runtime, so the file matches the
 * screen without a hex value in the component. Returns false when the browser cannot draw it.
 */
export function downloadQrPng(matrix: QrMatrix, filename: string): Promise<boolean> {
  const total = (matrix.count + QUIET * 2) * PNG_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = total;
  canvas.height = total;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(false);

  const tokens = getComputedStyle(document.documentElement);
  const surface = tokens.getPropertyValue("--color-surface").trim();
  const ink = tokens.getPropertyValue("--color-ink").trim();
  if (!surface || !ink) return Promise.resolve(false);
  context.fillStyle = surface;
  context.fillRect(0, 0, total, total);
  context.fillStyle = ink;
  for (let row = 0; row < matrix.count; row++) {
    for (let col = 0; col < matrix.count; col++) {
      if (matrix.isDark(row, col)) {
        context.fillRect((col + QUIET) * PNG_SCALE, (row + QUIET) * PNG_SCALE, PNG_SCALE, PNG_SCALE);
      }
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(false);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser a moment to start the download before the URL goes away.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      resolve(true);
    }, "image/png");
  });
}
