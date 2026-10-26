// L-06 / L-07 lifecycle: Done needs a cost or an explicit "no cost" (D-22); reopening writes a
// timeline entry and returns to Assigned or New (D-32), never a new request; dispatch moves New
// to Assigned (D-32).
import { describe, expect, it } from "vitest";

import {
  CLOSE_NEEDS_COST_MESSAGE,
  closeError,
  planMove,
  reopenTarget,
  statusAfterDispatch,
} from "../../src/app/(landlord)/maintenance/_lib/lifecycle";

describe("closing a request (D-22)", () => {
  it("accepts a cost, including zero rupees", () => {
    expect(closeError(1200, false)).toBeNull();
    expect(closeError(0, false)).toBeNull();
  });

  it("accepts an explicit no cost", () => {
    expect(closeError(null, true)).toBeNull();
  });

  it("refuses neither", () => {
    expect(closeError(null, false)).toBe(CLOSE_NEEDS_COST_MESSAGE);
  });

  it("refuses a cost together with no cost, and non-integer or negative costs (D-19)", () => {
    expect(closeError(500, true)).toBe(CLOSE_NEEDS_COST_MESSAGE);
    expect(closeError(99.5, false)).toBe(CLOSE_NEEDS_COST_MESSAGE);
    expect(closeError(-1, false)).toBe(CLOSE_NEEDS_COST_MESSAGE);
  });
});

describe("planMove", () => {
  it("does nothing when the status does not change", () => {
    expect(planMove("assigned", "assigned", null)).toEqual({ kind: "none" });
  });

  it("never moves straight to Done: closing goes through L-07 and the cost check", () => {
    for (const from of ["new", "assigned", "in_progress"] as const) {
      expect(planMove(from, "done", "v1")).toEqual({ kind: "close" });
    }
  });

  it("treats leaving Done as a reopen, to Assigned with a vendor and New without", () => {
    expect(planMove("done", "in_progress", "v1")).toEqual({ kind: "reopen", status: "assigned" });
    expect(planMove("done", "in_progress", null)).toEqual({ kind: "reopen", status: "new" });
    expect(planMove("done", "new", "v1")).toEqual({ kind: "reopen", status: "assigned" });
  });

  it("moves freely between the open columns", () => {
    expect(planMove("new", "in_progress", null)).toEqual({ kind: "move", status: "in_progress" });
    expect(planMove("in_progress", "new", "v1")).toEqual({ kind: "move", status: "new" });
  });
});

describe("D-32 status rules", () => {
  it("reopens to Assigned when a vendor is set, otherwise New", () => {
    expect(reopenTarget("v1")).toBe("assigned");
    expect(reopenTarget(null)).toBe("new");
  });

  it("moves only a New request to Assigned when a dispatch is confirmed", () => {
    expect(statusAfterDispatch("new")).toBe("assigned");
    expect(statusAfterDispatch("assigned")).toBe("assigned");
    expect(statusAfterDispatch("in_progress")).toBe("in_progress");
    expect(statusAfterDispatch("done")).toBe("done");
  });
});
