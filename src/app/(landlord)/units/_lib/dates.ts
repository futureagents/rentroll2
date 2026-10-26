// Calendar maths for L-08…L-11. Client-safe and pure: dates are ISO `YYYY-MM-DD` strings and
// months are `YYYY-MM` keys, so nothing depends on the time zone of the machine running it.
//
// PROMOTE: calendar helpers — lane/rent has the same maths in rent/_lib/calendar.ts (D-09, D-24);
// one shared module in src/lib should replace both copies.

export type IsoDate = string;
export type MonthKey = string;

/** India has had a fixed UTC+05:30 offset with no daylight saving since 1945. */
const KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** The calendar date in Asia/Kolkata at the instant `now` (D-24 counts days in Kolkata). */
export function kolkataToday(now: Date): IsoDate {
  return new Date(now.getTime() + KOLKATA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The Kolkata calendar date of a `timestamptz` value such as `request.created_at`. */
export function kolkataDateOf(timestamp: string): IsoDate {
  const time = Date.parse(timestamp);
  return Number.isNaN(time) ? timestamp.slice(0, 10) : kolkataToday(new Date(time));
}

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function firstOfMonth(month: MonthKey): IsoDate {
  return `${month}-01`;
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The same calendar date one year earlier; 29 Feb becomes 28 Feb. */
export function oneYearBefore(date: IsoDate): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  const day = Math.min(d, daysInMonth(`${y - 1}-${String(m).padStart(2, "0")}`));
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The rolling 12-month window ending today: after the same date last year, up to and including
 * today. Used by the L-09 last-12-months line and the repeated-category note (decisions §9).
 */
export function inLastTwelveMonths(date: IsoDate, today: IsoDate): boolean {
  return date > oneYearBefore(today) && date <= today;
}

/**
 * D-09: a rent entry's `due_on` is the agreement's `rent_due_day` in that month, clamped to the
 * month's last day; it never rolls into the next month.
 */
export function dueOnFor(month: MonthKey, rentDueDay: number): IsoDate {
  const day = Math.min(rentDueDay, daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Strict `YYYY-MM-DD` that names a real calendar date. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(`${y}-${String(m).padStart(2, "0")}`);
}
