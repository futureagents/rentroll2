// A2 · Confirm dialog: the action button says what it does — "Delete unit", never "OK".
import { describe, expect, it } from "vitest";
import { isForbiddenActionLabel } from "../src/components/ui/confirm-dialog";

describe("A2 confirm dialog action label", () => {
  it("rejects labels that do not name the action", () => {
    for (const label of ["OK", "ok", "Okay", "Yes", "Confirm", "Continue", "Proceed", " OK. "]) {
      expect(isForbiddenActionLabel(label), label).toBe(true);
    }
  });

  it("accepts labels that name the action", () => {
    for (const label of ["Delete unit", "End tenancy", "Record payment", "Discard changes", "Yes, send it"]) {
      expect(isForbiddenActionLabel(label), label).toBe(false);
    }
  });
});
