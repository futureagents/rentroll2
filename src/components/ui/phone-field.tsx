"use client";
// A2 · Phone field. Prefixed +91, accepts 10 digits, strips spaces and dashes as typed so
// the saved value is digits only.
import type { InputHTMLAttributes } from "react";
import { controlClasses, FieldShell, REQUIRED_MESSAGE, useBlurValidation } from "./field";

export const PHONE_MESSAGE = "Enter the 10-digit mobile number.";

/** Keeps digits only and caps at 10. */
export function normalisePhone(text: string): string {
  return text.replace(/\D/g, "").slice(0, 10);
}

export interface PhoneFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  label: string;
  /** Digits only, up to 10. */
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string | null;
  /** Extra validation after the 10-digit check. */
  validate?: (value: string) => string | null | undefined;
}

export function PhoneField({
  label,
  value,
  onChange,
  helper,
  error,
  validate,
  required,
  disabled,
  className,
  onBlur,
  placeholder = "98765 43210",
  ...rest
}: PhoneFieldProps) {
  const blur = useBlurValidation(
    value,
    (v) => (v !== "" && v.length !== 10 ? PHONE_MESSAGE : validate?.(v)),
    required ? REQUIRED_MESSAGE : null,
  );
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
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-(length:--text-body) text-muted"
          >
            +91
          </span>
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy || undefined}
            onChange={(event) => onChange(normalisePhone(event.target.value))}
            onBlur={(event) => {
              blur.onBlur();
              onBlur?.(event);
            }}
            className={controlClasses(invalid, "pl-12 tabular-nums")}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  );
}
