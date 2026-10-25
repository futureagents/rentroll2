// L-01: "After five failed attempts, add a 30-second delay and say so plainly."
import { describe, expect, it } from "vitest";

import {
  afterFailure,
  afterSuccess,
  DELAY_SECONDS,
  FAILED_ATTEMPTS_BEFORE_DELAY,
  secondsRemaining,
  THROTTLE_MESSAGE,
} from "../../src/lib/auth/throttle";

const now = new Date("2026-10-25T10:00:00.000Z");

describe("sign-in throttle rule", () => {
  it("does not delay the first four failures", () => {
    let state = null as ReturnType<typeof afterFailure> | null;
    for (let i = 1; i < FAILED_ATTEMPTS_BEFORE_DELAY; i++) {
      state = afterFailure(state, now);
      expect(state.failedCount).toBe(i);
      expect(state.lockedUntil).toBeNull();
      expect(secondsRemaining(state, now)).toBe(0);
    }
  });

  it("starts a 30-second delay on the fifth failure", () => {
    let state = null as ReturnType<typeof afterFailure> | null;
    for (let i = 0; i < FAILED_ATTEMPTS_BEFORE_DELAY; i++) state = afterFailure(state, now);
    expect(state!.failedCount).toBe(5);
    expect(secondsRemaining(state, now)).toBe(DELAY_SECONDS);
    expect(secondsRemaining(state, new Date(now.getTime() + 29_000))).toBe(1);
    expect(secondsRemaining(state, new Date(now.getTime() + 30_000))).toBe(0);
  });

  it("keeps delaying after the fifth failure", () => {
    const state = afterFailure({ failedCount: 7, lockedUntil: null }, now);
    expect(state.failedCount).toBe(8);
    expect(secondsRemaining(state, now)).toBe(DELAY_SECONDS);
  });

  it("clears on success", () => {
    expect(afterSuccess()).toEqual({ failedCount: 0, lockedUntil: null });
    expect(secondsRemaining(afterSuccess(), now)).toBe(0);
  });

  it("says so plainly", () => {
    expect(THROTTLE_MESSAGE).toMatch(/30 seconds/);
    expect(THROTTLE_MESSAGE).not.toMatch(/error|invalid|failed|unauthori[sz]ed/i);
  });
});
