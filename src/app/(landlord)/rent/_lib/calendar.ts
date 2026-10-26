// Rent calendar maths (D-09, D-24). Client-safe and pure: dates are ISO `YYYY-MM-DD` strings and
// months are `YYYY-MM` keys, so nothing depends on the time zone of the machine running it.
//
// PROMOTE: rent calendar helpers — shared by L-03, L-09 and S-01 once they count days late; they
// belong with the other rent rules in a shared rent module, not in this lane's folder.

export type IsoDate = string;
export type MonthKey = string;

/**
 * D-24: rent rows are created "on the 1st (Asia/Kolkata)". India has had a fixed UTC+05:30 offset
 * with no daylight saving since 1945, so a constant offset is exact and needs no time-zone data.
 */
const KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** The calendar date in Asia/Kolkata at the instant `now`. */
export function kolkataToday(now: Date): IsoDate {
  return new Date(now.getTime() + KOLKATA_OFFSET_MS).toISOString().slice(0, 10);
}

/** True while it is the 1st of a month in Asia/Kolkata (00:00–23:59 IST = 18:30 UTC the day before → 18:29 UTC). */
export function isFirstOfMonthInKolkata(now: Date): boolean {
  return kolkataToday(now).endsWith("-01");
}

export function isMonthKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return Boolean(match) && Number(match![2]) >= 1 && Number(match![2]) <= 12;
}

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function firstOfMonth(month: MonthKey): IsoDate {
  return `${month}-01`;
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function lastOfMonth(month: MonthKey): IsoDate {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function addMonths(month: MonthKey, count: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + count, 1));
  return date.toISOString().slice(0, 7);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * D-09: a rent entry's `due_on` is the agreement's `rent_due_day` in that month, clamped to the
 * month's last day. A due day of 29, 30 or 31 in a shorter month falls on that month's last day
 * (31 → 30 April, 28 February, or 29 February in a leap year); it never rolls into the next month.
 */
export function dueOnFor(month: MonthKey, rentDueDay: number): IsoDate {
  const day = Math.min(rentDueDay, daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}
