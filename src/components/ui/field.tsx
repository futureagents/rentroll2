"use client";
// A2 · Form fields, shared shell. Label above, helper text below, error replaces the helper
// in danger colour. Validation runs on blur, not on keystroke. The label is tied to its
// control and errors are announced (E5).
import { useCallback, useId, useState, type ReactNode } from "react";

export interface FieldShellProps {
  label: string;
  helper?: string;
  /** Controlled error; wins over the blur-validation error. */
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Extra line shown on the right of the helper row (the date field uses it). */
  aside?: ReactNode;
  className?: string;
  /** Receives the ids to wire the control: `id`, `aria-describedby`, `aria-invalid`. */
  children: (control: {
    id: string;
    describedBy: string;
    invalid: boolean;
    errorId: string;
    helperId: string;
  }) => ReactNode;
}

export function FieldShell({
  label,
  helper,
  error,
  required,
  disabled,
  aside,
  className = "",
  children,
}: FieldShellProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const describedBy = invalid ? errorId : helper ? helperId : "";
  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-60" : ""} ${className}`}>
      <label htmlFor={id} className="text-label uppercase text-muted">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid, errorId, helperId })}
      <div className="flex min-h-4 items-start justify-between gap-2 text-small">
        {invalid ? (
          <p id={errorId} role="alert" className="text-danger">
            {error}
          </p>
        ) : helper ? (
          <p id={helperId} className="text-muted">
            {helper}
          </p>
        ) : (
          <span />
        )}
        {aside && <span className="shrink-0 text-muted">{aside}</span>}
      </div>
    </div>
  );
}

/** Classes shared by text-like controls. */
export function controlClasses(invalid: boolean, extra = ""): string {
  return (
    "h-10 w-full rounded-sm border bg-surface px-3 text-body text-ink placeholder:text-muted " +
    "focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-canvas " +
    (invalid ? "border-danger focus:border-danger " : "border-line focus:border-primary ") +
    extra
  );
}

/**
 * Blur validation. Returns the current error and a blur handler; the error is recomputed
 * only on blur (A2: "Validates on blur, not on keystroke").
 */
export function useBlurValidation<T>(
  value: T,
  validate: ((value: T) => string | null | undefined) | undefined,
  requiredMessage: string | null,
) {
  const [error, setError] = useState<string | null>(null);
  const onBlur = useCallback(() => {
    if (requiredMessage !== null && isEmpty(value)) {
      setError(requiredMessage);
      return;
    }
    setError(validate?.(value) ?? null);
  }, [value, validate, requiredMessage]);
  return { error, onBlur };
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export const REQUIRED_MESSAGE = "This is needed to continue.";
