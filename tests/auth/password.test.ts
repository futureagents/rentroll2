// L-01: minimum 8 characters; strength is a single word.
import { describe, expect, it } from "vitest";

import { isPasswordLongEnough, passwordStrength } from "../../src/lib/auth/password";

describe("password rules (L-01)", () => {
  it("requires at least 8 characters", () => {
    expect(isPasswordLongEnough("1234567")).toBe(false);
    expect(isPasswordLongEnough("12345678")).toBe(true);
  });

  it("describes strength in one word", () => {
    expect(passwordStrength("short")).toBe("Too short");
    expect(passwordStrength("abcdefgh")).toBe("Weak");
    expect(passwordStrength("abcdefghij")).toBe("Fair");
    expect(passwordStrength("Abcdef12")).toBe("Fair");
    expect(passwordStrength("Abcdefgh1234")).toBe("Strong");
    for (const sample of ["x", "abcdefgh", "Abcdefgh1234"]) {
      expect(passwordStrength(sample).split(" ").length).toBeLessThanOrEqual(2);
    }
  });
});
