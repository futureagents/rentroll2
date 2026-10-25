// QR code rendered as inline SVG (crisp at any print size; no image request, so nothing can
// arrive broken on paper). Used by P-01 (payment QR, D-26) and P-03 (door QR, D-01).
import qrcode from "qrcode-generator";

export interface QrSvgProps {
  /** The exact text the code carries. */
  value: string;
  /** Printed edge length, in millimetres. */
  sizeMm: number;
  /** Accessible name for the image. */
  label: string;
  className?: string;
}

/** Quiet zone, in modules, on each side (the QR standard asks for 4). */
const QUIET = 4;

export function QrSvg({ value, sizeMm, label, className = "" }: QrSvgProps) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const total = count + QUIET * 2;

  let path = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={total} height={total} className="fill-surface" />
      <path d={path} className="fill-ink" />
    </svg>
  );
}
