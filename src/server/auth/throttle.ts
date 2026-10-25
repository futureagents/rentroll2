import "server-only";

import {
  afterFailure,
  afterSuccess,
  secondsRemaining,
  type ThrottleState,
} from "@/lib/auth/throttle";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

// L-01: "After five failed attempts, add a 30-second delay and say so plainly."
// Counters live in `signin_throttle`, a table with RLS on and no policies, so only the service
// role (this module) can read or write it. Keyed by email (citext), before any session exists.

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function readState(email: string): Promise<ThrottleState | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("signin_throttle")
    .select("failed_count, locked_until")
    .eq("email", normaliseEmail(email))
    .maybeSingle();
  if (!data) return null;
  return { failedCount: data.failed_count, lockedUntil: data.locked_until };
}

/** Seconds the caller must wait before another attempt for this email, or 0. */
export async function throttleSecondsRemaining(email: string, now = new Date()): Promise<number> {
  return secondsRemaining(await readState(email), now);
}

/** Records a failed attempt. Returns the seconds the caller must now wait (0 if none). */
export async function recordFailedAttempt(email: string, now = new Date()): Promise<number> {
  const next = afterFailure(await readState(email), now);
  const admin = createSupabaseAdminClient();
  await admin.from("signin_throttle").upsert(
    {
      email: normaliseEmail(email),
      failed_count: next.failedCount,
      last_failed_at: now.toISOString(),
      locked_until: next.lockedUntil,
    },
    { onConflict: "email" },
  );
  return secondsRemaining(next, now);
}

/** A successful sign-in clears the counter. */
export async function clearFailedAttempts(email: string): Promise<void> {
  const cleared = afterSuccess();
  const admin = createSupabaseAdminClient();
  await admin
    .from("signin_throttle")
    .update({ failed_count: cleared.failedCount, locked_until: cleared.lockedUntil })
    .eq("email", normaliseEmail(email));
}
