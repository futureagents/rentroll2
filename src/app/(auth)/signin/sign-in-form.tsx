"use client";
// L-01 · Sign in. Components L01-FLD-EMAIL, L01-FLD-PASS, L01-BTN-SIGNIN, L01-LNK-RESET,
// L01-LNK-SIGNUP. Enter in either field submits (native form submit).
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button, TextField } from "@/components/ui";
import { NEXT_PARAM } from "@/lib/auth/paths";

import { initialAuthState } from "../_components/auth-state";
import { FormError } from "../_components/form-error";
import { PasswordField } from "../_components/password-field";
import { signIn } from "./actions";

export function SignInForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(signIn, initialAuthState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // L01-FLD-EMAIL: "Autofocus on desktop only."
  useEffect(() => {
    if (!window.matchMedia("(min-width: 640px)").matches) return;
    formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
  }, []);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-2">
      <h1 className="mb-2 text-h1 text-ink">Sign in</h1>
      <FormError message={state.error} />
      {next ? <input type="hidden" name={NEXT_PARAM} value={next} /> : null}
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
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        required
      />
      <Button type="submit" variant="primary" block loading={pending} className="mt-2">
        Sign in
      </Button>
      <div className="mt-4 flex items-center justify-between text-small">
        <Link href="/reset" className="text-primary hover:underline">
          Forgot password
        </Link>
        <Link href="/signup" className="text-primary hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}
