import "server-only";

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/server/env";

// T-02 under a door token (D-02: the door token resolves "for creating a request and nothing
// else"). A door sticker can be photographed by anyone, and request numbers run in sequence per
// landlord (D-12), so T-02 must not re-render arbitrary numbers for it: it shows only the request
// this browser just created. The submit action proves that with this confirmation, set as an
// HttpOnly cookie scoped to /u/:token/reported and kept for `maxAgeMs` so a refresh still works.
// A tenant's own link needs none: it reaches T-03, which lists the same requests.

export const CONFIRMATION = {
  cookie: "rr_t02",
  maxAgeMs: 30 * 60 * 1000,
  skewMs: 5_000,
} as const;

export function confirmationKey(): Uint8Array {
  return new Uint8Array(
    hkdfSync("sha256", serverEnv().supabaseServiceRoleKey, "rentroll", "T-02 door confirmation v1", 32),
  );
}

function mac(key: Uint8Array, token: string, requestNumber: string, issuedAt: number): Buffer {
  return createHmac("sha256", key).update(`T-02:${issuedAt}:${requestNumber}:${token}`).digest();
}

/** `<issued ms>.<base64url HMAC>`; the token and number are in the MAC, not in the value. */
export function issueConfirmation(key: Uint8Array, token: string, requestNumber: string, nowMs: number): string {
  return `${nowMs}.${mac(key, token, requestNumber, nowMs).toString("base64url")}`;
}

export function verifyConfirmation(
  key: Uint8Array,
  token: string,
  requestNumber: string,
  value: unknown,
  nowMs: number,
): boolean {
  if (typeof value !== "string") return false;
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) return false;
  const issuedAt = Number(match[1]);
  const given = Buffer.from(match[2], "base64url");
  const expected = mac(key, token, requestNumber, issuedAt);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  const age = nowMs - issuedAt;
  return age >= -CONFIRMATION.skewMs && age <= CONFIRMATION.maxAgeMs;
}
