// L-09's quiet insight and its maintenance note.
//
// L09-TAB-OVERVIEW lifetime figures: total rent collected, total maintenance spend and net, over
// the unit's whole history — every tenancy, not just the current one. Beneath each, the last 12
// months (decisions §9: "both: lifetime, with a last-12-months line").
//
// L09-TAB-MAINT repeated-category note: a category reported 3 or more times in the rolling
// 12 months shows "Plumbing reported 4 times in 12 months." (decisions §9 threshold).
import { inLastTwelveMonths, kolkataDateOf, type IsoDate } from "./dates";

export interface PaymentForTotals {
  amount: number;
  status: "recorded" | "voided";
  receivedOn: IsoDate;
}

export interface RequestForTotals {
  status: "new" | "assigned" | "in_progress" | "done";
  cost: number | null;
  /** `request.done_at` (timestamptz); null until Done. */
  doneAt: string | null;
}

export interface Figures {
  collected: number;
  spend: number;
  net: number;
}

/**
 * Collected sums recorded payments (D-10; voided never count, D-11). Spend sums `cost` of Done
 * requests (D-22); "no cost" and open requests add nothing. A payment falls in the last 12 months
 * by the day it was received; a repair by the day it was marked Done.
 */
export function lifetimeFigures(
  payments: PaymentForTotals[],
  requests: RequestForTotals[],
  today: IsoDate,
): { lifetime: Figures; lastTwelveMonths: Figures } {
  const recorded = payments.filter((p) => p.status === "recorded");
  const done = requests.filter((r) => r.status === "done" && r.cost !== null && r.doneAt !== null);

  const collected = sum(recorded.map((p) => p.amount));
  const spend = sum(done.map((r) => r.cost ?? 0));
  const recentCollected = sum(recorded.filter((p) => inLastTwelveMonths(p.receivedOn, today)).map((p) => p.amount));
  const recentSpend = sum(
    done.filter((r) => inLastTwelveMonths(kolkataDateOf(r.doneAt as string), today)).map((r) => r.cost ?? 0),
  );

  return {
    lifetime: { collected, spend, net: collected - spend },
    lastTwelveMonths: { collected: recentCollected, spend: recentSpend, net: recentCollected - recentSpend },
  };
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

export type RequestCategory = "plumbing" | "electrical" | "appliance" | "structural" | "pest" | "cleaning" | "other";

/** D-33 category enum as people say it. */
export const CATEGORY_LABEL: Record<RequestCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  appliance: "Appliance",
  structural: "Structural",
  pest: "Pest",
  cleaning: "Cleaning",
  other: "Other",
};

/** Decisions §9: "repeated" means 3 or more reports in 12 months. */
export const REPEAT_THRESHOLD = 3;

/**
 * One note per category reported at least REPEAT_THRESHOLD times in the rolling 12 months, most
 * frequent first. Counts the effective category (D-21) of every request created in the window,
 * whatever its status: the note is about what keeps breaking, not what is still open.
 */
export function repeatedCategoryNotes(
  requests: { category: RequestCategory; createdAt: string }[],
  today: IsoDate,
): string[] {
  const counts = new Map<RequestCategory, number>();
  for (const r of requests) {
    if (!inLastTwelveMonths(kolkataDateOf(r.createdAt), today)) continue;
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= REPEAT_THRESHOLD)
    .sort((a, b) => b[1] - a[1] || CATEGORY_LABEL[a[0]].localeCompare(CATEGORY_LABEL[b[0]]))
    .map(([category, n]) => `${CATEGORY_LABEL[category]} reported ${n} times in 12 months.`);
}
