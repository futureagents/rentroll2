// Date formatting (A2, CLAUDE.md §5). Dates display as `DD MMM YYYY` everywhere; CSV exports
// are the only exception (`YYYY-MM-DD`, D-40). Inputs are ISO `YYYY-MM-DD` strings (calendar
// dates, no time zone) or Date objects read in local time.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Ymd {
  y: number;
  m: number; // 0-based
  d: number;
}

function toYmd(value: string | Date | null | undefined): Ymd | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { y: value.getFullYear(), m: value.getMonth(), d: value.getDate() };
  }
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
  if (!match) return null;
  const m = Number(match[2]) - 1;
  if (m < 0 || m > 11) return null;
  const d = match[3] === undefined ? 1 : Number(match[3]);
  if (d < 1 || d > 31) return null;
  return { y: Number(match[1]), m, d };
}

/** `DD MMM YYYY` (A2): "2026-10-05" → "05 Oct 2026". Empty when unparseable. */
export function formatDate(value: string | Date | null | undefined): string {
  const ymd = toYmd(value);
  if (!ymd) return "";
  return `${String(ymd.d).padStart(2, "0")} ${MONTHS_SHORT[ymd.m]} ${ymd.y}`;
}

/** `DD MMM YYYY, HH:MM` for timeline timestamps (A2 Timeline). */
export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)}, ${hh}:${mm}`;
}

/**
 * A rent month as people say it: "2026-10" (or any date in that month) → "October 2026".
 * Used where a month, not a day, is the subject (P-01 "month", E2-02).
 */
export function formatMonth(value: string | Date | null | undefined): string {
  const ymd = toYmd(value);
  if (!ymd) return "";
  return `${MONTHS_LONG[ymd.m]} ${ymd.y}`;
}

/** `YYYY-MM-DD` for CSV cells only (D-40). Empty when unparseable. */
export function formatDateCsv(value: string | Date | null | undefined): string {
  const ymd = toYmd(value);
  if (!ymd) return "";
  return `${ymd.y}-${String(ymd.m + 1).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
}
