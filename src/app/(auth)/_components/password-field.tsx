"use client";
// L01-FLD-PASS: "Label 'Password'. Show/hide toggle on the right."
// PROMOTE: a password field with a show/hide toggle belongs in A2 (Form fields) next to the
// text field; this is the minimum local version for L-01.
import { useState } from "react";

import { TextField, type TextFieldProps } from "@/components/ui";

export type PasswordFieldProps = Omit<TextFieldProps, "type">;

export function PasswordField({ className = "", ...props }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <TextField {...props} type={shown ? "text" : "password"} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        className="absolute top-0 right-0 h-4 text-label uppercase text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}
