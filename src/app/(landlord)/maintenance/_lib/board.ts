// L-06 · board maths: ordering, ageing borders, filters, columns. Pure, so it is tested
// directly (tests/maintenance/board.test.ts).
import type { BoardCard, RequestStatus, Urgency } from "./model";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** D-32: "urgent, normal, low". Lower rank sorts first. */
export const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, normal: 1, low: 2 };

/** The higher of two urgencies (D-21: the assistant may raise urgency, never lower it). */
export function higherUrgency(a: Urgency, b: Urgency | null | undefined): Urgency {
  if (!b) return a;
  return URGENCY_RANK[b] < URGENCY_RANK[a] ? b : a;
}

/**
 * D-32: "cards within a column order by urgency (urgent, normal, low) then by age, oldest
 * first." Urgency is the effective value (D-21), which starts as the higher of the tenant's
 * and the assistant's.
 */
export function compareCards(a: Pick<BoardCard, "urgency" | "createdAt">, b: Pick<BoardCard, "urgency" | "createdAt">): number {
  const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (byUrgency !== 0) return byUrgency;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function sortCards<T extends Pick<BoardCard, "urgency" | "createdAt">>(cards: readonly T[]): T[] {
  return [...cards].sort(compareCards);
}

export type Ageing = "none" | "warning" | "danger";

/**
 * L-06 rule: "Cards in New older than 48 hours gain a subtle left border in warning colour.
 * Older than 7 days, danger colour. No notification, just a visual."
 */
export function ageing(status: RequestStatus, createdAt: string | Date, now: Date): Ageing {
  if (status !== "new") return "none";
  const age = now.getTime() - new Date(createdAt).getTime();
  if (age > 7 * DAY_MS) return "danger";
  if (age > 48 * HOUR_MS) return "warning";
  return "none";
}

/** L06-CRD-REQUEST "age in days": whole days since the report. */
export function ageInDays(createdAt: string | Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS));
}

export function ageLabel(createdAt: string | Date, now: Date): string {
  const days = ageInDays(createdAt, now);
  if (days === 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}

/** L06-SEG-FILTER: All · Urgent · Unassigned · This property. */
export type BoardFilter = "all" | "urgent" | "unassigned" | "property";

/**
 * D-16: "Unassigned" = `vendor_id is null`. "This property" with several properties is a
 * decisions §9 OPEN; read literally, it narrows to the property the landlord picks.
 */
export function applyFilter<T extends Pick<BoardCard, "urgency" | "vendorId" | "propertyId">>(
  cards: readonly T[],
  filter: BoardFilter,
  propertyId: string | null,
): T[] {
  switch (filter) {
    case "all":
      return [...cards];
    case "urgent":
      return cards.filter((card) => card.urgency === "urgent");
    case "unassigned":
      return cards.filter((card) => card.vendorId === null);
    case "property":
      return propertyId ? cards.filter((card) => card.propertyId === propertyId) : [...cards];
  }
}

/** Cards grouped into the four columns, each in D-32 order. New is always first (L06-COL-NEW). */
export function groupByStatus<T extends Pick<BoardCard, "status" | "urgency" | "createdAt">>(
  cards: readonly T[],
): Record<RequestStatus, T[]> {
  const columns: Record<RequestStatus, T[]> = { new: [], assigned: [], in_progress: [], done: [] };
  for (const card of cards) columns[card.status].push(card);
  for (const status of Object.keys(columns) as RequestStatus[]) {
    columns[status] = sortCards(columns[status]);
  }
  return columns;
}

/** E2-03 "No open requests": open = not Done (D-32, L-03 "not closed"). */
export function openCount(cards: readonly Pick<BoardCard, "status">[]): number {
  return cards.filter((card) => card.status !== "done").length;
}

/** L06-CRD-REQUEST "first line of the description". */
export function firstLine(description: string): string {
  return description.trim().split(/\r?\n/, 1)[0] ?? "";
}
