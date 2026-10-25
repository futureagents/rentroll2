// L-01: "Password minimum 8 characters on sign-up, with strength shown as a single word, not a bar."

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordStrength = "Too short" | "Weak" | "Fair" | "Strong";

/** One word, never a bar. Length first, then variety of character classes. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return "Too short";
  const classes =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (password.length >= 12 && classes >= 3) return "Strong";
  if (password.length >= 10 || classes >= 3) return "Fair";
  return "Weak";
}

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}
