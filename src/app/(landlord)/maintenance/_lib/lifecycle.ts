// L-06, L-07 · request lifecycle rules (D-22, D-32). Pure; the server actions call these
// before writing, and tests/maintenance/lifecycle.test.ts covers them.
import type { RequestStatus } from "./model";

/** L-06: "Moving a card to Done requires either a cost figure or an explicit 'no cost'". */
export const CLOSE_NEEDS_COST_MESSAGE = "Add what it cost, or tick No cost, to close this request.";

/** T01-FLD-DESC: "Required, minimum 10 characters." (L06-BTN-NEW uses the same form.) */
export const DESCRIPTION_SHORT = "Describe it in at least 10 characters.";

/** D-22: Done is valid when `cost is not null or no_cost`. Cost and "no cost" are exclusive. */
export function closeError(cost: number | null, noCost: boolean): string | null {
  if (noCost && cost !== null) return CLOSE_NEEDS_COST_MESSAGE;
  if (noCost) return null;
  if (cost === null || !Number.isInteger(cost) || cost < 0) return CLOSE_NEEDS_COST_MESSAGE;
  return null;
}

/** D-32: "Reopening from Done sets `assigned` if a vendor is set, otherwise `new`". */
export function reopenTarget(vendorId: string | null): RequestStatus {
  return vendorId ? "assigned" : "new";
}

/** D-32: confirming a `vendor_dispatch` moves a `new` request to `assigned`; nothing else. */
export function statusAfterDispatch(status: RequestStatus): RequestStatus {
  return status === "new" ? "assigned" : status;
}

export type MovePlan =
  | { kind: "none" }
  /** D-22: dragging to Done opens L-07 with Done chosen; the move commits only when L-07 saves. */
  | { kind: "close" }
  /** L-06: reopening "writes a timeline entry rather than creating a new request". */
  | { kind: "reopen"; status: RequestStatus }
  | { kind: "move"; status: RequestStatus };

/** What a drag on L-06 (or a status change on L-07) from `from` to `to` means. */
export function planMove(from: RequestStatus, to: RequestStatus, vendorId: string | null): MovePlan {
  if (from === to) return { kind: "none" };
  if (to === "done") return { kind: "close" };
  if (from === "done") return { kind: "reopen", status: reopenTarget(vendorId) };
  return { kind: "move", status: to };
}
