"use client";
// L-01 · /reset. One email field; the confirmation is identical whether or not the email exists.
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button, TextField } from "@/components/ui";

import { initialAuthState } from "../_components/auth-state";
import { FormError, FormNotice } from "../_components/form-error";
import { requestReset } from "./actions";

export function ResetForm() {
  const [state, action, pending] = useActionState(requestReset, initialAuthState);
  const [email, setEmail] = useState("");

  if (state.notice) {
    return (
      <div>
        <h1 className="mb-2 text-h1 text-ink">Reset password</h1>
        <FormNotice message={state.notice} />
        <Link href="/signin" className="text-small text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-2">
      <h1 className="mb-2 text-h1 text-ink">Reset password</h1>
      <FormError message={state.error} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        required
        helper="We will send a link to set a new password."
      />
      <Button type="submit" variant="primary" block loading={pending} className="mt-2">
        Send reset link
      </Button>
      <p className="mt-4 text-small">
        <Link href="/signin" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
