// A2 · shared formatting used by the component library.
// PROMOTE: money and date formatters belong in src/lib (CLAUDE.md §5). This file is the
// minimum local version so the A2 fields can render ₹ with Indian grouping (D-19) and
// DD MMM YYYY dates without the lane touching src/lib.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Indian digit grouping of a non-negative integer: 186000 → "1,86,000" (D-19). */
export function groupIndian(digits: string): string {
  const clean = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (clean.length <= 3) return clean;
  const last3 = clean.slice(-3);
  const rest = clean.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

/** Whole rupees with the ₹ sign and Indian grouping: 186000 → "₹1,86,000" (D-19). */
export function formatRupees(amount: number): string {
  const whole = Math.round(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${groupIndian(String(whole))}`;
}

/**
 * Abbreviated rupees for stat cards only (D-19): 210000 → "₹2.1L", 36000 → "₹36k".
 * Tables never use this.
 */
export function formatRupeesShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${trimZero((abs / 1_00_00_000).toFixed(1))}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trimZero((abs / 1_00_000).toFixed(1))}L`;
  if (abs >= 10_000) return `${sign}₹${Math.round(abs / 1000)}k`;
  return formatRupees(amount);
}

function trimZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Parses a money field's text into whole rupees, or null when empty. */
export function parseRupees(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}

/** `DD MMM YYYY` from an ISO `YYYY-MM-DD` string or a Date (A2). Empty when unparseable. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  let y: number, m: number, d: number;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    y = value.getFullYear();
    m = value.getMonth();
    d = value.getDate();
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return "";
    y = Number(match[1]);
    m = Number(match[2]) - 1;
    d = Number(match[3]);
    if (m < 0 || m > 11) return "";
  }
  return `${String(d).padStart(2, "0")} ${MONTHS[m]} ${y}`;
}

/** `DD MMM YYYY, HH:MM` for timeline timestamps. */
export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)}, ${hh}:${mm}`;
}
