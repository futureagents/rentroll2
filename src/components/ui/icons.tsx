// A2 · inline icons used by the library and the screens. No icon package is installed;
// these are 16×16 stroke glyphs that take `currentColor`.
import type { SVGProps } from "react";

export type IconName =
  | "call"
  | "copy"
  | "share"
  | "print"
  | "close"
  | "check"
  | "plus"
  | "chevron-down"
  | "arrow-up"
  | "arrow-down"
  | "arrow-right"
  | "photo"
  | "bell"
  | "rupee"
  | "note"
  | "warning"
  | "trash";

const PATHS: Record<IconName, string> = {
  call: "M4 2h3l1.5 4-2 1.2a9 9 0 0 0 4.3 4.3L12 9.5l4 1.5v3a1 1 0 0 1-1 1A13 13 0 0 1 3 3a1 1 0 0 1 1-1z",
  copy: "M6 6h8v8H6zM4 10H2V2h8v2",
  share: "M8 2v8M5 5l3-3 3 3M3 9v4h10V9",
  print: "M4 6V2h8v4M4 12H2V6h12v6h-2M4 10h8v4H4z",
  close: "M3 3l10 10M13 3L3 13",
  check: "M2.5 8.5l3.5 3.5 7.5-8",
  plus: "M8 2v12M2 8h12",
  "chevron-down": "M3 6l5 5 5-5",
  "arrow-up": "M8 13V3M4 7l4-4 4 4",
  "arrow-down": "M8 3v10M4 9l4 4 4-4",
  "arrow-right": "M3 8h10M9 4l4 4-4 4",
  photo: "M2 3h12v10H2zM2 11l3.5-3.5 2.5 2.5 2-2L14 12M11 6h.01",
  bell: "M4 11V7a4 4 0 0 1 8 0v4l1 1H3zM6.5 14h3",
  rupee: "M4 2h8M4 5.5h8M4 2c5 0 5 7 0 7h0l5 5",
  note: "M3 2h7l3 3v9H3zM10 2v3h3M5.5 8h5M5.5 11h5",
  warning: "M8 2l6.5 11.5h-13zM8 7v3M8 12h.01",
  trash: "M2.5 4h11M6 4V2h4v2M4 4l.8 10h6.4L12 4M6.5 7v4M9.5 7v4",
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Pixel size; 16 by default. */
  size?: number;
}

export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
