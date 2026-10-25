"use client";
// A2 · Money field. Prefixed ₹, digits only, Indian thousands separators shown as the user
// types (D-19), no decimals. Value is whole rupees or null when empty.
import type { InputHTMLAttributes } from "react";
import { controlClasses, FieldShell, REQUIRED_MESSAGE, useBlurValidation } from "./field";
import { groupIndian, parseRupees } from "./format";

export interface MoneyFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  helper?: string;
  error?: string | null;
  validate?: (value: number | null) => string | null | undefined;
}

export function MoneyField({
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
  placeholder = "0",
  ...rest
}: MoneyFieldProps) {
  const blur = useBlurValidation(value, validate, required ? REQUIRED_MESSAGE : null);
  const shown = error ?? blur.error;
  const text = value === null ? "" : groupIndian(String(Math.round(Math.abs(value))));
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
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted"
          >
            ₹
          </span>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy || undefined}
            onChange={(event) => onChange(parseRupees(event.target.value))}
            onBlur={(event) => {
              blur.onBlur();
              onBlur?.(event);
            }}
            className={controlClasses(invalid, "pl-7 text-right tabular-nums")}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  );
}
