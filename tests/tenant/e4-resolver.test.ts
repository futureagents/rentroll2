// E4-1, E4-2, E4-3, E4-8 and the vacant-unit state (T-01 States, D-01…D-05): every way a token
// can fail resolves to the same single result, and nothing about why.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findOwnRequestWith, onlyTenantLink, resolveWith } from "../../src/server/tenant/resolve";
import type { TenantRepo } from "../../src/server/tenant/repo";
import { fakeRepo, T } from "./fixtures";

const alter = (token: string, at = 7) =>
  token.slice(0, at) + (token[at] === "0" ? "1" : "0") + token.slice(at + 1);

describe("token resolution (D-01, D-02)", () => {
  it("resolves an active tenant link to its own tenancy", async () => {
    const resolved = await resolveWith(fakeRepo(), T.aActive);
    expect(resolved?.scope).toEqual({ landlordId: "L-A", unitId: "U-A-2A", tenancyId: "TN-A-active" });
    expect(resolved?.view.kind).toBe("tenant");
  });

  it("resolves a door token to whichever tenancy is active on the unit, with no pre-fill and no requests (D-02)", async () => {
    const resolved = await resolveWith(fakeRepo(), T.aDoorOccupied);
    expect(resolved?.scope).toEqual({ landlordId: "L-A", unitId: "U-A-2A", tenancyId: "TN-A-active" });
    expect(resolved?.view).toEqual({
      kind: "door",
      header: {
        unitLabel: "Flat 2A",
        propertyName: "Kulkarni Apartments",
        landlordName: "Anil Kulkarni",
        landlordPhone: "+919000000101",
      },
    });
  });

  it("lists only this tenancy's own requests, newest first, with tenant-safe status words (D-30)", async () => {
    const resolved = await resolveWith(fakeRepo(), T.aActive);
    if (resolved?.view.kind !== "tenant") throw new Error("expected a tenant link");
    expect(resolved.view.requests).toEqual([
      { requestNumber: "R-0003", category: "Something else", reportedOn: "22 Oct 2026", status: "In progress" },
      { requestNumber: "R-0001", category: "Plumbing", reportedOn: "20 Oct 2026", status: "Received" },
    ]);
  });

  it("pre-fills name and the 10-digit phone from the tenancy record (T01-FLD-NAME, T01-FLD-PHONE)", async () => {
    const resolved = await resolveWith(fakeRepo(), T.aActive);
    if (resolved?.view.kind !== "tenant") throw new Error("expected a tenant link");
    expect(resolved.view.prefill).toEqual({ name: "Priya Deshpande", phone: "9000000303" });
  });

  it("always runs both token lookups, whichever kind the token turns out to be", async () => {
    for (const token of [T.aActive, T.aDoorOccupied, alter(T.aActive), T.aEnded, T.aDoorVacant]) {
      const repo = fakeRepo();
      await resolveWith(repo, token);
      expect(repo.calls.slice(0, 2).sort()).toEqual(["findDoor", "findTenantLink"]);
    }
  });
});

describe("every failure is the same single result", () => {
  const failures: [string, string][] = [
    ["E4-2: a former tenant's link after the tenancy ended", T.aEnded],
    ["E4-2: a link whose tenancy is settled", T.aSettled],
    ["T-01 Unit is vacant: a door token with no active tenancy", T.aDoorVacant],
    ["E4-3: one character altered in a tenant link", alter(T.aActive)],
    ["E4-3: one character altered in a door token", alter(T.aDoorOccupied, 30)],
    ["E4-3: truncated", T.aActive.slice(0, 39)],
    ["E4-3: one character too long", T.aActive + "0"],
    ["E4-3: upper-cased", T.aActive.toUpperCase()],
    ["E4-3: padded with whitespace", ` ${T.aActive} `],
    ["E4-3: url-encoded junk", "%27%20or%201%3D1--"],
    ["E4-3: PostgREST filter injection", `${T.aActive},status.eq.ended`],
    ["unknown, well-formed", "f".repeat(40)],
    ["empty", ""],
    ["a unit number instead of a token (T-01: /u/2A must not work)", "2A"],
  ];

  for (const [name, token] of failures) {
    it(name, async () => {
      await expect(resolveWith(fakeRepo(), token)).resolves.toBeNull();
    });
  }

  it("treats a repository failure exactly like an unknown token", async () => {
    const broken = { ...fakeRepo(), findTenantLink: () => Promise.reject(new Error("db down")) } as TenantRepo;
    await expect(resolveWith(broken, T.aActive)).resolves.toBeNull();
  });

  it("never asks the database about a token that cannot be one", async () => {
    const repo = fakeRepo();
    await resolveWith(repo, "2A");
    await resolveWith(repo, `${T.aActive},status.eq.ended`);
    expect(repo.calls).toEqual([]);
  });
});

describe("E4-1 (restated by D-04): a valid token with another landlord's or tenancy's identifier", () => {
  it("finds the token's own request by number", async () => {
    const repo = fakeRepo();
    const resolved = (await resolveWith(repo, T.aActive))!;
    await expect(findOwnRequestWith(repo, resolved, "R-0001")).resolves.toEqual({
      requestNumber: "R-0001",
      category: "Plumbing",
      reportedOn: "20 Oct 2026",
      status: "Received",
      photoCount: 2,
    });
  });

  it("refuses landlord B's request number from landlord A's token", async () => {
    const repo = fakeRepo();
    const resolved = (await resolveWith(repo, T.aActive))!;
    await expect(findOwnRequestWith(repo, resolved, "R-0007")).resolves.toBeNull();
  });

  it("refuses a number the token's landlord uses for another unit's request", async () => {
    const repo = fakeRepo();
    const resolved = (await resolveWith(repo, T.aActive))!;
    await expect(findOwnRequestWith(repo, resolved, "R-9999")).resolves.toBeNull();
  });

  it("refuses the former tenant's request on the same unit", async () => {
    const repo = fakeRepo();
    const resolved = (await resolveWith(repo, T.aActive))!;
    await expect(findOwnRequestWith(repo, resolved, "R-0002")).resolves.toBeNull();
  });

  it("resolves the same number to each landlord's own request (D-12 per-landlord sequences)", async () => {
    const repo = fakeRepo();
    const b = (await resolveWith(repo, T.bActive))!;
    expect(b.scope.landlordId).toBe("L-B");
    const own = await findOwnRequestWith(repo, b, "R-0001");
    expect(own?.requestNumber).toBe("R-0001");
  });

  it("refuses malformed request numbers without querying", async () => {
    const repo = fakeRepo();
    const resolved = (await resolveWith(repo, T.aActive))!;
    repo.calls.length = 0;
    for (const bad of ["RQ-1", "R-1", "0001", "R-0001;", "R-0001,landlord_id.eq.L-B", ""]) {
      await expect(findOwnRequestWith(repo, resolved, bad)).resolves.toBeNull();
    }
    expect(repo.calls).toEqual([]);
  });
});

describe("E4-8: a door token reaches T-01 and T-02 only (D-02)", () => {
  it("is refused by the guard every T-03, T-04, T-05 and tenant P-01 route must use", async () => {
    const repo = fakeRepo();
    const door = await resolveWith(repo, T.aDoorOccupied);
    const link = await resolveWith(repo, T.aActive);
    expect(onlyTenantLink(door)).toBeNull();
    expect(onlyTenantLink(null)).toBeNull();
    expect(onlyTenantLink(link)).toBe(link);
  });

  it("never lists requests for a door token", async () => {
    const repo = fakeRepo();
    await resolveWith(repo, T.aDoorOccupied);
    expect(repo.calls).not.toContain("listRequests");
  });
});
