// D-02: a door token resolves "for creating a request and nothing else". T-02 under a door token
// therefore re-renders only the request this browser just created, proved by a short-lived signed
// confirmation the submit action sets as an HttpOnly cookie. Without it: E1-10.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CONFIRMATION, issueConfirmation, verifyConfirmation } from "../../src/server/tenant/confirmation";
import { findConfirmedRequestWith, resolveWith } from "../../src/server/tenant/resolve";
import { fakeRepo, T } from "./fixtures";

const key = new TextEncoder().encode("test-confirmation-key");
const t0 = Date.parse("2026-10-26T10:00:00.000Z");

describe("T-02 confirmation", () => {
  it("accepts the confirmation for the same link and request within its life", () => {
    const value = issueConfirmation(key, T.aDoorOccupied, "R-0412", t0);
    expect(verifyConfirmation(key, T.aDoorOccupied, "R-0412", value, t0)).toBe(true);
    expect(verifyConfirmation(key, T.aDoorOccupied, "R-0412", value, t0 + CONFIRMATION.maxAgeMs)).toBe(true);
  });

  it("refuses it for another request number (stepping through R-nnnn)", () => {
    const value = issueConfirmation(key, T.aDoorOccupied, "R-0412", t0);
    expect(verifyConfirmation(key, T.aDoorOccupied, "R-0411", value, t0)).toBe(false);
  });

  it("refuses it on another link, after it expires, from the future, or forged", () => {
    const value = issueConfirmation(key, T.aDoorOccupied, "R-0412", t0);
    expect(verifyConfirmation(key, T.bDoor, "R-0412", value, t0)).toBe(false);
    expect(verifyConfirmation(key, T.aDoorOccupied, "R-0412", value, t0 + CONFIRMATION.maxAgeMs + 1)).toBe(false);
    expect(verifyConfirmation(key, T.aDoorOccupied, "R-0412", issueConfirmation(key, T.aDoorOccupied, "R-0412", t0 + 60_000), t0)).toBe(false);
    expect(verifyConfirmation(new TextEncoder().encode("other"), T.aDoorOccupied, "R-0412", value, t0)).toBe(false);
    for (const junk of ["", "x", undefined, null, `${t0}.AAAA`]) {
      expect(verifyConfirmation(key, T.aDoorOccupied, "R-0412", junk as never, t0)).toBe(false);
    }
  });

  it("does not carry the token", () => {
    expect(issueConfirmation(key, T.aDoorOccupied, "R-0412", t0)).not.toContain(T.aDoorOccupied);
  });
});

describe("T-02 as the page calls it (findConfirmedRequestWith)", () => {
  const deps = (repo = fakeRepo()) => ({ repo, confirmationKey: () => key, now: () => t0 + 1000 });

  it("door token + the confirmation for that exact number: shows it", async () => {
    const d = deps();
    const door = (await resolveWith(d.repo, T.aDoorOccupied))!;
    const cookie = issueConfirmation(key, T.aDoorOccupied, "R-0001", t0);
    expect((await findConfirmedRequestWith(d, T.aDoorOccupied, door, "R-0001", cookie))?.requestNumber).toBe("R-0001");
  });

  it("door token + a confirmation for another number, another link or none: E1-10", async () => {
    const d = deps();
    const door = (await resolveWith(d.repo, T.aDoorOccupied))!;
    const forOther = issueConfirmation(key, T.aDoorOccupied, "R-0003", t0);
    const forTenantLink = issueConfirmation(key, T.aActive, "R-0001", t0);
    for (const cookie of [forOther, forTenantLink, undefined, ""]) {
      await expect(findConfirmedRequestWith(d, T.aDoorOccupied, door, "R-0001", cookie)).resolves.toBeNull();
    }
  });

  it("tenant link: no confirmation needed", async () => {
    const d = deps();
    const link = (await resolveWith(d.repo, T.aActive))!;
    expect((await findConfirmedRequestWith(d, T.aActive, link, "R-0001", undefined))?.requestNumber).toBe("R-0001");
  });
});
