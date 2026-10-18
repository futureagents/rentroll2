"use client";
// A2 · Date field. Native date picker; the chosen date is echoed as DD MMM YYYY so the
// product's one date format is visible regardless of the browser's own display.
import type { InputHTMLAttributes } from "react";
import { controlClasses, FieldShell, REQUIRED_MESSAGE, useBlurValidation } from "./field";
import { formatDate } from "./format";

export interface DateFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  label: string;
  /** ISO `YYYY-MM-DD` or empty. */
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string | null;
  validate?: (value: string) => string | null | undefined;
}

export function DateField({
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
  ...rest
}: DateFieldProps) {
  const blur = useBlurValidation(value, validate, required ? REQUIRED_MESSAGE : null);
  const shown = error ?? blur.error;
  const echo = formatDate(value);
  return (
    <FieldShell
      label={label}
      helper={helper}
      error={shown}
      required={required}
      disabled={disabled}
      className={className}
      aside={echo || undefined}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type="date"
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
          className={controlClasses(invalid, "tabular-nums")}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
