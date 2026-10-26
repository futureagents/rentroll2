// L-06 board maths: D-32 ordering (urgency, then oldest first; urgency is the effective value,
// the higher of tenant-stated and assistant-suggested per D-21), the 48-hour / 7-day ageing
// borders, L06-SEG-FILTER and the E2-03 open count.
import { describe, expect, it } from "vitest";

import {
  ageInDays,
  ageLabel,
  ageing,
  applyFilter,
  firstLine,
  groupByStatus,
  higherUrgency,
  openCount,
  sortCards,
} from "../../src/app/(landlord)/maintenance/_lib/board";
import type { BoardCard } from "../../src/app/(landlord)/maintenance/_lib/model";

const NOW = new Date("2026-10-26T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function card(overrides: Partial<BoardCard>): BoardCard {
  return {
    id: "r",
    requestNumber: "R-0001",
    status: "new",
    category: "plumbing",
    urgency: "normal",
    description: "Tap drips",
    unitNumber: "2A",
    propertyId: "p1",
    propertyName: "Kulkarni Apartments",
    vendorId: null,
    hasTenant: true,
    createdAt: hoursAgo(1),
    thumbnailUrl: null,
    ...overrides,
  };
}

describe("L-06 card order (D-32)", () => {
  it("puts urgent before normal before low, whatever the age", () => {
    const sorted = sortCards([
      card({ id: "low", urgency: "low", createdAt: hoursAgo(500) }),
      card({ id: "normal", urgency: "normal", createdAt: hoursAgo(300) }),
      card({ id: "urgent", urgency: "urgent", createdAt: hoursAgo(1) }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["urgent", "normal", "low"]);
  });

  it("orders cards of the same urgency oldest first", () => {
    const sorted = sortCards([
      card({ id: "young", createdAt: hoursAgo(2) }),
      card({ id: "old", createdAt: hoursAgo(80) }),
      card({ id: "middle", createdAt: hoursAgo(30) }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["old", "middle", "young"]);
  });

  it("does not reorder the caller's array", () => {
    const cards = [card({ id: "b", urgency: "low" }), card({ id: "a", urgency: "urgent" })];
    sortCards(cards);
    expect(cards.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("higherUrgency (D-21: the assistant may raise urgency, never lower it)", () => {
  it("takes the higher of tenant-stated and assistant-suggested", () => {
    expect(higherUrgency("normal", "urgent")).toBe("urgent");
    expect(higherUrgency("urgent", "low")).toBe("urgent");
    expect(higherUrgency("low", "normal")).toBe("normal");
  });

  it("keeps the tenant's urgency when there is no suggestion", () => {
    expect(higherUrgency("low", null)).toBe("low");
    expect(higherUrgency("normal", undefined)).toBe("normal");
  });
});

describe("L-06 ageing borders", () => {
  it("is none up to 48 hours, warning after 48 hours, danger after 7 days", () => {
    expect(ageing("new", hoursAgo(47), NOW)).toBe("none");
    expect(ageing("new", hoursAgo(48), NOW)).toBe("none");
    expect(ageing("new", hoursAgo(49), NOW)).toBe("warning");
    expect(ageing("new", hoursAgo(7 * 24), NOW)).toBe("warning");
    expect(ageing("new", hoursAgo(7 * 24 + 1), NOW)).toBe("danger");
  });

  it("applies only to cards in New", () => {
    for (const status of ["assigned", "in_progress", "done"] as const) {
      expect(ageing(status, hoursAgo(30 * 24), NOW)).toBe("none");
    }
  });
});

describe("L06-CRD-REQUEST age in days", () => {
  it("counts whole days since the report", () => {
    expect(ageInDays(hoursAgo(23), NOW)).toBe(0);
    expect(ageInDays(hoursAgo(24), NOW)).toBe(1);
    expect(ageInDays(hoursAgo(9 * 24 + 5), NOW)).toBe(9);
    expect(ageLabel(hoursAgo(2), NOW)).toBe("Today");
    expect(ageLabel(hoursAgo(25), NOW)).toBe("1 day");
    expect(ageLabel(hoursAgo(72), NOW)).toBe("3 days");
  });

  it("never goes negative for a timestamp slightly in the future", () => {
    expect(ageInDays(hoursAgo(-1), NOW)).toBe(0);
  });
});

describe("L06-SEG-FILTER", () => {
  const cards = [
    card({ id: "u1", urgency: "urgent", vendorId: "v1", propertyId: "p1" }),
    card({ id: "n1", urgency: "normal", vendorId: null, propertyId: "p2" }),
    card({ id: "l1", urgency: "low", vendorId: "v2", propertyId: "p2" }),
  ];
  const ids = (list: BoardCard[]) => list.map((c) => c.id);

  it("All shows everything", () => {
    expect(ids(applyFilter(cards, "all", null))).toEqual(["u1", "n1", "l1"]);
  });
  it("Urgent uses the effective urgency", () => {
    expect(ids(applyFilter(cards, "urgent", null))).toEqual(["u1"]);
  });
  it("Unassigned means no vendor (D-16), not status", () => {
    expect(ids(applyFilter(cards, "unassigned", null))).toEqual(["n1"]);
  });
  it("This property narrows to the chosen property", () => {
    expect(ids(applyFilter(cards, "property", "p2"))).toEqual(["n1", "l1"]);
    expect(ids(applyFilter(cards, "property", null))).toEqual(["u1", "n1", "l1"]);
  });
});

describe("columns and the E2-03 empty state", () => {
  it("groups into the four statuses, each in D-32 order", () => {
    const columns = groupByStatus([
      card({ id: "a", status: "assigned" }),
      card({ id: "n-low", status: "new", urgency: "low" }),
      card({ id: "n-urgent", status: "new", urgency: "urgent" }),
      card({ id: "d", status: "done" }),
    ]);
    expect(Object.keys(columns)).toEqual(["new", "assigned", "in_progress", "done"]);
    expect(columns.new.map((c) => c.id)).toEqual(["n-urgent", "n-low"]);
    expect(columns.in_progress).toEqual([]);
  });

  it("does not count Done cards as open", () => {
    expect(openCount([card({ status: "done" }), card({ status: "done" })])).toBe(0);
    expect(openCount([card({ status: "done" }), card({ status: "in_progress" })])).toBe(1);
  });

  it("shows the first line of the description", () => {
    expect(firstLine("  Geyser leaking\nsince yesterday")).toBe("Geyser leaking");
  });
});
