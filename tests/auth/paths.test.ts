// L-01 / E4-6 — the return-to-intended-screen parameter must never become an open redirect.
import { describe, expect, it } from "vitest";

import {
  isAuthEntryPath,
  isLandlordPath,
  sanitizeNextPath,
  signInRedirectPath,
} from "../../src/lib/auth/paths";

describe("isLandlordPath (E4-6 protected prefixes)", () => {
  it.each(["/landlord", "/rent", "/rent/42", "/units/abc", "/settings", "/setup", "/print/receipt/1"])(
    "protects %s",
    (p) => expect(isLandlordPath(p)).toBe(true),
  );
  it.each(["/", "/u/abc", "/u/abc/receipts", "/signin", "/signup", "/reset", "/rentals", "/dev/components"])(
    "leaves %s public",
    (p) => expect(isLandlordPath(p)).toBe(false),
  );
});

describe("isAuthEntryPath", () => {
  it("matches /signin and /signup only", () => {
    expect(isAuthEntryPath("/signin")).toBe(true);
    expect(isAuthEntryPath("/signup")).toBe(true);
    expect(isAuthEntryPath("/reset")).toBe(false);
    expect(isAuthEntryPath("/rent")).toBe(false);
  });
});

describe("sanitizeNextPath", () => {
  it("keeps a same-origin landlord path with its query", () => {
    expect(sanitizeNextPath("/rent")).toBe("/rent");
    expect(sanitizeNextPath("/rent?month=2026-02")).toBe("/rent?month=2026-02");
    expect(sanitizeNextPath("/units/abc")).toBe("/units/abc");
  });
  it.each([
    null,
    undefined,
    "",
    "https://evil.example/rent",
    "//evil.example/rent",
    "/\\evil.example",
    "/rent\\..",
    "rent",
    "/u/sometoken",
    "/signin",
    "/",
    "/rent ",
    "/rent?x=http://a",
    "/landlord/" + "a".repeat(3000),
  ])("rejects %s", (value) => {
    expect(sanitizeNextPath(value as string | null | undefined)).toBeNull();
  });
});

describe("signInRedirectPath", () => {
  it("carries the intended screen", () => {
    expect(signInRedirectPath("/rent/42")).toBe("/signin?next=%2Frent%2F42");
  });
  it("drops an unsafe target", () => {
    expect(signInRedirectPath("//evil.example")).toBe("/signin");
  });
});
