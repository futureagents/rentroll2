"use client";
// L-01 · /signup. D-20: name, email, password. "Password minimum 8 characters on sign-up, with
// strength shown as a single word, not a bar."
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button, TextField } from "@/components/ui";
import { isPasswordLongEnough, PASSWORD_MIN_LENGTH, passwordStrength } from "@/lib/auth/password";

import { initialAuthState } from "../_components/auth-state";
import { FormError, FormNotice } from "../_components/form-error";
import { PasswordField } from "../_components/password-field";
import { signUp } from "./actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialAuthState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (state.notice) {
    return (
      <div>
        <h1 className="mb-2 text-h1 text-ink">Create an account</h1>
        <FormNotice message={state.notice} />
        <Link href="/signin" className="text-small text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  const strength = password ? passwordStrength(password) : null;

  return (
    <form action={action} noValidate className="flex flex-col gap-2">
      <h1 className="mb-2 text-h1 text-ink">Create an account</h1>
      <FormError message={state.error} />
      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        value={name}
        onChange={setName}
        required
        helper="Shown on receipts unless you set a business name later."
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        required
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        required
        helper={strength ? `Strength: ${strength}` : `At least ${PASSWORD_MIN_LENGTH} characters.`}
        validate={(v) => (isPasswordLongEnough(v) ? null : `Use at least ${PASSWORD_MIN_LENGTH} characters.`)}
      />
      <Button type="submit" variant="primary" block loading={pending} className="mt-2">
        Create account
      </Button>
      <p className="mt-4 text-small">
        Already have an account?{" "}
        <Link href="/signin" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
