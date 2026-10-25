"use client";
// A2 · Text field. Label above, helper below, error replaces helper. Validates on blur.
import type { InputHTMLAttributes } from "react";
import { controlClasses, FieldShell, REQUIRED_MESSAGE, useBlurValidation } from "./field";

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string | null;
  /** Runs on blur; return a message to show it, or null. */
  validate?: (value: string) => string | null | undefined;
  type?: "text" | "email" | "password" | "url";
}

export function TextField({
  label,
  value,
  onChange,
  helper,
  error,
  validate,
  required,
  disabled,
  className,
  type = "text",
  onBlur,
  ...rest
}: TextFieldProps) {
  const blur = useBlurValidation(value, validate, required ? REQUIRED_MESSAGE : null);
  const shown = error ?? blur.error;
  return (
    <FieldShell
      label={label}
      helper={helper}
      error={shown}
      required={required}
      disabled={disabled}
      className={className}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            blur.onBlur();
            onBlur?.(event);
          }}
          className={controlClasses(invalid)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
