// T01-BTN-SUBMIT on the server: token → bot check → validation → rate limit → photos → create.
// The token is the only identifier the server trusts; nothing in the form can move the request.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PHOTO_MESSAGES } from "../../src/lib/tenant/photos";
import { FIELD_MESSAGES, TENANT_MESSAGES } from "../../src/lib/tenant/report";
import { BOT_CHECK, issueStamp } from "../../src/server/tenant/bot-check";
import { RATE_LIMIT, submitReportWith, type SubmitDeps } from "../../src/server/tenant/submit";
import { addRecentRequests, buildWorld, fakeRepo, T } from "./fixtures";

const key = new TextEncoder().encode("test-key-not-a-secret");
const now = new Date("2026-10-26T10:00:00.000Z");
const rendered = now.getTime() - 60_000;

const jpeg = (n = 1) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, n, 0, 0, 0])], `IMG_${n}.HEIC`, { type: "image/heic" });

function form(token: string, over: Record<string, string> = {}, photos: File[] = []) {
  const data = new FormData();
  const fields = {
    category: "plumbing",
    description: "Geyser is leaking from the bottom since yesterday.",
    urgency: "urgent",
    name: "Priya Deshpande",
    phone: "9000000303",
    stamp: issueStamp(key, token, rendered),
    website: "",
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  for (const photo of photos) data.append("photo", photo);
  return data;
}

function setup(world = buildWorld()) {
  const repo = fakeRepo(world);
  const deps: SubmitDeps = { repo, botKey: key, now: () => now };
  return { repo, deps, world };
}

describe("a report is created for the token's own tenancy", () => {
  it("creates the request with the tenant's choices and returns only its number", async () => {
    const { repo, deps } = setup();
    const result = await submitReportWith(deps, T.aActive, form(T.aActive, {}, [jpeg(1), jpeg(2)]));
    expect(result).toEqual({ status: "reported", requestNumber: "R-0101" });
    expect(repo.created).toHaveLength(1);
    const [{ scope, input }] = repo.created;
    expect(scope).toEqual({ landlordId: "L-A", unitId: "U-A-2A", tenancyId: "TN-A-active" });
    expect(input.report).toEqual({
      category: "plumbing",
      description: "Geyser is leaking from the bottom since yesterday.",
      urgency: "urgent",
      name: "Priya Deshpande",
      phone: "+919000000303",
    });
    // Type comes from the bytes, not the file's claim (HEIC name, JPEG bytes).
    expect(input.photos.map((p) => p.mime)).toEqual(["image/jpeg", "image/jpeg"]);
  });

  it("attaches a door-sticker report to the unit's current tenancy (D-02, D-29)", async () => {
    const { repo, deps } = setup();
    const result = await submitReportWith(deps, T.aDoorOccupied, form(T.aDoorOccupied, { name: "", phone: "" }));
    expect(result.status).toBe("reported");
    expect(repo.created[0].scope).toEqual({ landlordId: "L-A", unitId: "U-A-2A", tenancyId: "TN-A-active" });
    expect(repo.created[0].input.report).toMatchObject({ name: null, phone: null });
  });

  it("ignores any identifier smuggled into the form", async () => {
    const { repo, deps } = setup();
    await submitReportWith(
      deps,
      T.aActive,
      form(T.aActive, { landlord_id: "L-B", unit_id: "U-B-G1", tenancy_id: "TN-B-active", token: T.bActive }),
    );
    expect(repo.created[0].scope).toEqual({ landlordId: "L-A", unitId: "U-A-2A", tenancyId: "TN-A-active" });
  });
});

describe("a link that does not resolve creates nothing", () => {
  for (const [name, token] of [
    ["E4-2 ended tenancy", T.aEnded],
    ["vacant unit", T.aDoorVacant],
    ["E4-3 altered", T.aActive.slice(0, 39) + "0"],
    ["junk", "2A"],
  ] as const) {
    it(name, async () => {
      const { repo, deps } = setup();
      await expect(submitReportWith(deps, token, form(token))).resolves.toEqual({ status: "invalid-link" });
      expect(repo.calls).not.toContain("createRequest");
    });
  }
});

describe("invisible bot check (T-01 Rules)", () => {
  it("refuses a filled honeypot with the ordinary retry message, never a puzzle", async () => {
    const { repo, deps } = setup();
    const result = await submitReportWith(deps, T.aActive, form(T.aActive, { website: "http://spam.example" }));
    expect(result).toEqual({ status: "retry", message: TENANT_MESSAGES.submitFailed });
    expect(repo.calls).not.toContain("createRequest");
  });

  it("refuses a submit faster than the minimum fill time", async () => {
    const { repo, deps } = setup();
    const stamp = issueStamp(key, T.aActive, now.getTime() - BOT_CHECK.minFillMs + 100);
    const result = await submitReportWith(deps, T.aActive, form(T.aActive, { stamp }));
    expect(result).toEqual({ status: "retry", message: TENANT_MESSAGES.submitFailed });
    expect(repo.calls).not.toContain("createRequest");
  });

  it("hands back a fresh stamp when the page has been open too long, so the retry works", async () => {
    const { deps } = setup();
    const stamp = issueStamp(key, T.aActive, now.getTime() - BOT_CHECK.maxAgeMs - 1);
    const result = await submitReportWith(deps, T.aActive, form(T.aActive, { stamp }));
    expect(result.status).toBe("retry");
    if (result.status !== "retry") return;
    expect(result.message).toBe(TENANT_MESSAGES.submitFailed);
    expect(result.stamp).toBeTruthy();
    const retried = await submitReportWith(
      { ...deps, now: () => new Date(now.getTime() + BOT_CHECK.minFillMs) },
      T.aActive,
      form(T.aActive, { stamp: result.stamp! }),
    );
    expect(retried.status).toBe("reported");
  });

  it("refuses a missing or forged stamp", async () => {
    const { deps } = setup();
    for (const stamp of ["", "123.abc", issueStamp(new TextEncoder().encode("forged"), T.aActive, rendered)]) {
      const result = await submitReportWith(deps, T.aActive, form(T.aActive, { stamp }));
      expect(result).toEqual({ status: "retry", message: TENANT_MESSAGES.submitFailed });
    }
  });
});

describe("validation errors come back per field (shown under the field, T-01)", () => {
  it("returns field errors and creates nothing", async () => {
    const { repo, deps } = setup();
    const result = await submitReportWith(deps, T.aActive, form(T.aActive, { category: "", description: "leak" }));
    expect(result).toEqual({
      status: "fields",
      errors: { category: FIELD_MESSAGES.category, description: FIELD_MESSAGES.description },
    });
    expect(repo.calls).not.toContain("createRequest");
  });

  it("refuses more than three photos (S-04: 3 on tenant screens)", async () => {
    const { deps } = setup();
    const result = await submitReportWith(deps, T.aActive, form(T.aActive, {}, [jpeg(1), jpeg(2), jpeg(3), jpeg(4)]));
    expect(result).toEqual({ status: "fields", errors: { photos: PHOTO_MESSAGES.count } });
  });

  it("refuses a photo that is not an image, with the S04-ERR wording", async () => {
    const { deps } = setup();
    const gif = new File([new TextEncoder().encode("GIF89a........")], "x.jpg", { type: "image/jpeg" });
    const result = await submitReportWith(deps, T.aActive, form(T.aActive, {}, [gif]));
    expect(result).toEqual({ status: "fields", errors: { photos: PHOTO_MESSAGES.type } });
  });

  it("ignores empty file parts (a browser sends one when no photo was picked)", async () => {
    const { repo, deps } = setup();
    const result = await submitReportWith(deps, T.aActive, form(T.aActive, {}, [new File([], "")]));
    expect(result.status).toBe("reported");
    expect(repo.created[0].input.photos).toEqual([]);
  });
});

describe("rate limit: 5 submissions per hour (T-01 Rules)", () => {
  it(`allows the ${RATE_LIMIT.max}th submission and refuses the next with a plain message`, async () => {
    const { world, deps } = setup();
    world.requests = world.requests.filter((r) => r.tenancy_id !== "TN-A-active");
    addRecentRequests(world, "TN-A-active", RATE_LIMIT.max - 1, now);
    expect((await submitReportWith(deps, T.aActive, form(T.aActive))).status).toBe("reported");
    // The fake stamps the new row with the real clock; pin it inside the window.
    world.requests.at(-1)!.created_at = new Date(now.getTime() - 60_000).toISOString();
    await expect(submitReportWith(deps, T.aActive, form(T.aActive))).resolves.toEqual({
      status: "retry",
      message: TENANT_MESSAGES.rateLimited,
    });
  });

  it("counts only the last hour", async () => {
    const { world, deps } = setup();
    world.requests = world.requests.filter((r) => r.tenancy_id !== "TN-A-active");
    addRecentRequests(world, "TN-A-active", RATE_LIMIT.max, now, 61);
    expect((await submitReportWith(deps, T.aActive, form(T.aActive))).status).toBe("reported");
  });

  it("shares one budget between the door sticker and the tenant link (stricter than per token, never looser)", async () => {
    const { world, deps } = setup();
    world.requests = world.requests.filter((r) => r.tenancy_id !== "TN-A-active");
    addRecentRequests(world, "TN-A-active", RATE_LIMIT.max, now);
    const result = await submitReportWith(deps, T.aDoorOccupied, form(T.aDoorOccupied));
    expect(result).toEqual({ status: "retry", message: TENANT_MESSAGES.rateLimited });
  });

  it("does not count requests the landlord logged by phone (D-29)", async () => {
    const { world, deps } = setup();
    world.requests = world.requests.filter((r) => r.tenancy_id !== "TN-A-active");
    addRecentRequests(world, "TN-A-active", RATE_LIMIT.max, now);
    for (const r of world.requests) if (r.tenancy_id === "TN-A-active") r.reported_via = "phone";
    expect((await submitReportWith(deps, T.aActive, form(T.aActive))).status).toBe("reported");
  });
});

describe("a failed create keeps the tenant on the form", () => {
  it("returns the T-01 retry message when the write is refused", async () => {
    const { repo, deps } = setup();
    repo.createRequest = () => Promise.reject(new Error("storage down"));
    await expect(submitReportWith(deps, T.aActive, form(T.aActive))).resolves.toEqual({
      status: "retry",
      message: TENANT_MESSAGES.submitFailed,
    });
  });
});
