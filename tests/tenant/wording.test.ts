// E1 wording rules on every tenant-facing string T-01 and T-02 can show, and the exact texts the
// spec fixes (E1-06, E1-08 via D-31, E1-10, D-28).
import { describe, expect, it } from "vitest";

import { PHOTO_MESSAGES } from "../../src/lib/tenant/photos";
import { FIELD_MESSAGES, reportedMessage, TENANT_MESSAGES, TENANT_STATUS_WORD } from "../../src/lib/tenant/report";

const everyString = [
  ...Object.values(TENANT_MESSAGES),
  ...Object.values(FIELD_MESSAGES),
  ...Object.values(PHOTO_MESSAGES),
  ...Object.values(TENANT_STATUS_WORD),
  reportedMessage("R-0412"),
];

describe("E1 wording rules", () => {
  it("never uses the words error, invalid, failed or unauthorised", () => {
    for (const text of everyString) expect(text).not.toMatch(/\b(error|invalid|failed|fail|unauthori[sz]ed)\b/i);
  });

  it("never says 'not found'", () => {
    for (const text of everyString) expect(text.toLowerCase()).not.toContain("not found");
  });
});

describe("fixed texts", () => {
  it("E1-10 invalid tenant link, word for word", () => {
    expect(TENANT_MESSAGES.invalidLink).toBe("This link is not valid. Please ask your landlord for your unit link.");
  });

  it("E1-06 confirmation and the D-28 line (no claim that anyone was notified)", () => {
    expect(reportedMessage("R-0412")).toBe("Reported. Your request number is R-0412.");
    expect(TENANT_MESSAGES.onTheBoard).toBe("Your landlord will see this on their board.");
    expect(everyString.join(" ").toLowerCase()).not.toContain("notified");
  });

  it("E1-08 offline banner on T-01 (D-31)", () => {
    expect(TENANT_MESSAGES.offline).toBe("You are offline. We will save this when you reconnect.");
  });

  it("T-01 submission failed", () => {
    expect(TENANT_MESSAGES.submitFailed).toBe("Could not submit. Please try again.");
  });

  it("T03-CHP-STATUS words (D-30): New shows as Received", () => {
    expect(TENANT_STATUS_WORD).toEqual({ new: "Received", assigned: "Assigned", in_progress: "In progress", done: "Done" });
  });
});
