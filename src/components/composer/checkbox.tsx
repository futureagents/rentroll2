"use client";
// PROMOTE: checkbox → A2 form fields (new row "Checkbox": label beside the box, helper below,
// disabled state explains why). S01-CHK-PAYLINK is the first checkbox in the product.
import { useId, type ReactNode } from "react";

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Below the label; when disabled, says why (A2 disabled rule). */
  helper?: ReactNode;
}

export function Checkbox({ label, checked, onChange, disabled, helper }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={helper ? `${id}-helper` : undefined}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className={disabled ? "text-muted" : "text-body"}>
          {label}
        </label>
        {helper && (
          <div id={`${id}-helper`} className="text-small text-muted">
            {helper}
          </div>
        )}
      </div>
    </div>
  );
}
