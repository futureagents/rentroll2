// Calendar-date helpers. Dates are plain 'YYYY-MM-DD' strings handled in UTC,
// so no host timezone can shift a day. "Today" is taken in Asia/Kolkata.

const DAY = 86_400_000;

export function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function iso(date) {
  return date.toISOString().slice(0, 10);
}

export function todayInKolkata() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function isValidIso(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(toDate(s)) === s;
}

export function addDays(isoDate, n) {
  return iso(new Date(toDate(isoDate).getTime() + n * DAY));
}

export function diffDays(a, b) {
  return Math.round((toDate(a) - toDate(b)) / DAY);
}

export function daysInMonth(year, month1) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

// Same day-of-month n months later, clamped to the month's last day.
export function addMonths(isoDate, n) {
  const d = toDate(isoDate);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const y = Math.floor(total / 12);
  const m1 = (total % 12) + 1;
  const day = Math.min(d.getUTCDate(), daysInMonth(y, m1));
  return iso(new Date(Date.UTC(y, m1 - 1, day)));
}

export function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

export function firstOfMonth(isoDate) {
  return `${monthKey(isoDate)}-01`;
}

// Day `day` of the month containing isoDate, clamped to that month's length.
export function dayInMonth(isoDate, day) {
  const d = toDate(isoDate);
  const y = d.getUTCFullYear();
  const m1 = d.getUTCMonth() + 1;
  return iso(new Date(Date.UTC(y, m1 - 1, Math.min(day, daysInMonth(y, m1)))));
}

export function dayOfMonth(isoDate) {
  return toDate(isoDate).getUTCDate();
}

export function maxIso(a, b) {
  return a > b ? a : b;
}
