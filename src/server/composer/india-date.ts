import "server-only";

// Calendar dates in India time (D-09 counts days late from `due_on`, a date with no zone). Not a
// display formatter: the composer formats with src/lib/format.
const INDIA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` of an instant in India time. */
export function indiaDate(instant: Date | string): string {
  return INDIA_DATE.format(typeof instant === "string" ? new Date(instant) : instant);
}

export function todayInIndia(now: Date = new Date()): string {
  return indiaDate(now);
}
