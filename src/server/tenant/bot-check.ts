import "server-only";

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/server/env";

// T-01 Rules: "A bot check runs invisibly. A tenant should never see a puzzle."
//
// Two checks, no third party:
//  - a honeypot field people never see or reach, which form-filling bots tend to fill;
//  - a render stamp the server signs when T-01 is rendered, bound to the link it was rendered for.
//    A submit must come at least `minFillMs` after it (no person types a report faster) and within
//    `maxAgeMs` (an older stamp is refused but replaced, so a long-open form still sends).
// A bot needs a valid 160-bit link before either check matters, and the rate limit caps what one
// link can do; this only has to stop blind form-posting.

export const BOT_CHECK = {
  minFillMs: 3_000,
  maxAgeMs: 24 * 60 * 60 * 1000,
  /** Allowed clock disagreement between server instances, in the stamp's favour. */
  skewMs: 5_000,
  stampField: "stamp",
  honeypotField: "website",
} as const;

export type StampResult = "ok" | "too-fast" | "expired" | "bad";

/** A per-deployment key derived from the service-role secret; it never leaves the server. */
export function botKey(): Uint8Array {
  return new Uint8Array(
    hkdfSync("sha256", serverEnv().supabaseServiceRoleKey, "rentroll", "T-01 render stamp v1", 32),
  );
}

function mac(key: Uint8Array, token: string, issuedAt: number): Buffer {
  return createHmac("sha256", key).update(`T-01:${issuedAt}:${token}`).digest();
}

/** `<issued ms>.<base64url HMAC>`; the token is in the MAC, not in the stamp. */
export function issueStamp(key: Uint8Array, token: string, nowMs: number): string {
  return `${nowMs}.${mac(key, token, nowMs).toString("base64url")}`;
}

export function verifyStamp(key: Uint8Array, token: string, stamp: unknown, nowMs: number): StampResult {
  if (typeof stamp !== "string") return "bad";
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(stamp);
  if (!match) return "bad";
  const issuedAt = Number(match[1]);
  const given = Buffer.from(match[2], "base64url");
  const expected = mac(key, token, issuedAt);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "bad";
  const age = nowMs - issuedAt;
  if (age < -BOT_CHECK.skewMs) return "bad";
  if (age < BOT_CHECK.minFillMs) return "too-fast";
  if (age > BOT_CHECK.maxAgeMs) return "expired";
  return "ok";
}
