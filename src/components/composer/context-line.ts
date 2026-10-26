// S-01 · S01-CHP-CONTEXT chip words (D-38, D-41) and the S01-BNR-STALE warning (D-41).
// Pure: dates are `YYYY-MM-DD` calendar dates in India time.
import { formatDate } from "@/lib/format";

import type { Level } from "./ladder";

/** Whole days from `from` to `to` (both `YYYY-MM-DD`); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const start = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const end = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((end - start) / 86_400_000);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "Rent · 18 days overdue · Level 2 of 3 · 1 sent · 1 called", one chip per part. */
export function rentContextChips(input: {
  daysOverdue: number;
  dueOn: string;
  level: Level;
  remindersSent: number;
  callsLogged: number;
}): string[] {
  const chips = ["Rent"];
  chips.push(
    input.daysOverdue > 0
      ? `${plural(input.daysOverdue, "day")} overdue`
      : input.daysOverdue === 0
        ? "Due today"
        : `Due ${formatDate(input.dueOn)}`,
  );
  chips.push(`Level ${input.level} of 3`);
  chips.push(`${input.remindersSent} sent`);
  if (input.callsLogged > 0) chips.push(`${input.callsLogged} called`);
  return chips;
}

/**
 * D-41 S01-BNR-STALE. Shown when the landlord's last rent-board update falls before the
 * entry's due date and the due date has arrived: a reminder drafted from an unreconciled board
 * may go to a tenant who has already paid. Information only; it never blocks sending.
 */
export function staleBoardNote(input: {
  /** Date of the last rent-board update (`YYYY-MM-DD`), or null when nothing was ever recorded. */
  lastUpdateOn: string | null;
  dueOn: string;
  today: string;
}): string | null {
  if (daysBetween(input.dueOn, input.today) < 0) return null; // not due yet
  if (input.lastUpdateOn === null) {
    return "You have not updated this board yet — check before sending."; // E1-13 †
  }
  if (daysBetween(input.lastUpdateOn, input.dueOn) <= 0) return null; // updated on or after the due date
  const ago = daysBetween(input.lastUpdateOn, input.today);
  return `You last updated this board ${plural(ago, "day")} ago — check before sending.`; // E1-12 †
}
