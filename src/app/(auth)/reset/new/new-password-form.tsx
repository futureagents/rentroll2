"use client";
// L-01 · /reset/new — set the new password after following the email link.
import { useActionState, useState } from "react";

import { Button } from "@/components/ui";
import { isPasswordLongEnough, PASSWORD_MIN_LENGTH, passwordStrength } from "@/lib/auth/password";

import { initialAuthState } from "../../_components/auth-state";
import { FormError } from "../../_components/form-error";
import { PasswordField } from "../../_components/password-field";
import { setNewPassword } from "../actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(setNewPassword, initialAuthState);
  const [password, setPassword] = useState("");
  const strength = password ? passwordStrength(password) : null;

  return (
    <form action={action} noValidate className="flex flex-col gap-2">
      <h1 className="mb-2 text-h1 text-ink">Set a new password</h1>
      <FormError message={state.error} />
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        required
        helper={strength ? `Strength: ${strength}` : `At least ${PASSWORD_MIN_LENGTH} characters.`}
        validate={(v) => (isPasswordLongEnough(v) ? null : `Use at least ${PASSWORD_MIN_LENGTH} characters.`)}
      />
      <Button type="submit" variant="primary" block loading={pending} className="mt-2">
        Save password
      </Button>
    </form>
  );
}
