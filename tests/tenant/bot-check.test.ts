// T-01 Rules: "A bot check runs invisibly. A tenant should never see a puzzle." The check is a
// server-signed render stamp (minimum fill time, maximum age, bound to the link) plus a honeypot.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BOT_CHECK, issueStamp, verifyStamp } from "../../src/server/tenant/bot-check";
import { T } from "./fixtures";

const key = new TextEncoder().encode("test-key-not-a-secret");
const otherKey = new TextEncoder().encode("another-key");
const t0 = Date.parse("2026-10-26T10:00:00.000Z");

describe("render stamp", () => {
  it("passes a stamp submitted after the minimum fill time", () => {
    const stamp = issueStamp(key, T.aActive, t0);
    expect(verifyStamp(key, T.aActive, stamp, t0 + BOT_CHECK.minFillMs)).toBe("ok");
    expect(verifyStamp(key, T.aActive, stamp, t0 + BOT_CHECK.maxAgeMs)).toBe("ok");
  });

  it("refuses a submit faster than a person can fill the form", () => {
    const stamp = issueStamp(key, T.aActive, t0);
    expect(verifyStamp(key, T.aActive, stamp, t0 + BOT_CHECK.minFillMs - 1)).toBe("too-fast");
  });

  it("reports an old stamp as expired so the form can be given a fresh one", () => {
    const stamp = issueStamp(key, T.aActive, t0);
    expect(verifyStamp(key, T.aActive, stamp, t0 + BOT_CHECK.maxAgeMs + 1)).toBe("expired");
  });

  it("refuses a stamp from the future (clock games)", () => {
    const stamp = issueStamp(key, T.aActive, t0 + 60_000);
    expect(verifyStamp(key, T.aActive, stamp, t0)).toBe("bad");
  });

  it("refuses a tampered, forged, foreign or missing stamp", () => {
    const stamp = issueStamp(key, T.aActive, t0);
    const [time, mac] = stamp.split(".");
    const later = t0 + 10_000;
    expect(verifyStamp(key, T.aActive, `${Number(time) - 5000}.${mac}`, later)).toBe("bad");
    expect(verifyStamp(key, T.aActive, `${time}.${mac.slice(0, -2)}AA`, later)).toBe("bad");
    expect(verifyStamp(otherKey, T.aActive, stamp, later)).toBe("bad");
    expect(verifyStamp(key, T.aDoorOccupied, stamp, later)).toBe("bad"); // bound to the link it was issued on
    for (const junk of ["", "abc", ".", `${time}.`, `.${mac}`, "1.2.3", null, undefined, 42]) {
      expect(verifyStamp(key, T.aActive, junk as never, later)).toBe("bad");
    }
  });

  it("does not put the token in the stamp", () => {
    expect(issueStamp(key, T.aActive, t0)).not.toContain(T.aActive);
  });
});
