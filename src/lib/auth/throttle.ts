// L-01 rule: "After five failed attempts, add a 30-second delay and say so plainly."
// Pure rule; the server wrapper in src/server/auth/throttle.ts stores the counters.

export const FAILED_ATTEMPTS_BEFORE_DELAY = 5;
export const DELAY_SECONDS = 30;

/** L-01 gives no wording for the delay message; this is the plain statement it asks for. */
export const THROTTLE_MESSAGE = `Too many attempts. Please wait ${DELAY_SECONDS} seconds and try again.`;
/** L-01: "Email or password is incorrect." Never say which one is wrong. */
export const INCORRECT_MESSAGE = "Email or password is incorrect.";

export interface ThrottleState {
  failedCount: number;
  /** ISO timestamp or null. */
  lockedUntil: string | null;
}

/** Seconds the caller must still wait, or 0 when a sign-in attempt may proceed. */
export function secondsRemaining(state: ThrottleState | null, now: Date): number {
  if (!state?.lockedUntil) return 0;
  const until = new Date(state.lockedUntil).getTime();
  if (Number.isNaN(until)) return 0;
  return Math.max(0, Math.ceil((until - now.getTime()) / 1000));
}

/** Next state after a failed attempt: the fifth failure (and every one after it) starts a delay. */
export function afterFailure(state: ThrottleState | null, now: Date): ThrottleState {
  const failedCount = (state?.failedCount ?? 0) + 1;
  const lockedUntil =
    failedCount >= FAILED_ATTEMPTS_BEFORE_DELAY
      ? new Date(now.getTime() + DELAY_SECONDS * 1000).toISOString()
      : null;
  return { failedCount, lockedUntil };
}

/** A successful sign-in clears the counter. */
export function afterSuccess(): ThrottleState {
  return { failedCount: 0, lockedUntil: null };
}
