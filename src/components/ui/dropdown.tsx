"use client";
// A2 · Dropdown. Native select (so phones get their own picker). Always has a placeholder
// that is not a valid choice: it is disabled and maps to the empty value.
import type { SelectHTMLAttributes } from "react";
import { controlClasses, FieldShell, REQUIRED_MESSAGE, useBlurValidation } from "./field";
import { Icon } from "./icons";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> {
  label: string;
  /** Empty string means nothing chosen. */
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** Shown while nothing is chosen; never a valid choice. */
  placeholder?: string;
  helper?: string;
  error?: string | null;
  validate?: (value: string) => string | null | undefined;
}

export function Dropdown({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose one",
  helper,
  error,
  validate,
  required,
  disabled,
  className,
  onBlur,
  ...rest
}: DropdownProps) {
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
        <div className="relative">
          <select
            id={id}
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
            className={controlClasses(invalid, `appearance-none pr-8 ${value === "" ? "text-muted" : ""}`)}
            {...rest}
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
      )}
    </FieldShell>
  );
}
