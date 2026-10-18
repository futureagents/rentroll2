"use client";
// A2 · Segmented choice. 2–4 options shown as adjacent buttons; used for urgency and
// status filters. Behaves as a radio group for keyboard and screen readers (E5).
import { useId, type KeyboardEvent } from "react";
import type { ButtonSize } from "./button";

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: string;
}

export interface SegmentedChoiceProps<V extends string = string> {
  /** Visible label above the group; set `hideLabel` to keep it for screen readers only. */
  label: string;
  hideLabel?: boolean;
  /** Two to four options. */
  options: readonly SegmentedOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  size?: ButtonSize;
  disabled?: boolean;
  helper?: string;
  error?: string | null;
  className?: string;
}

const HEIGHT: Record<ButtonSize, string> = {
  32: "h-8 px-3 text-small",
  40: "h-10 px-4 text-body",
  48: "h-12 px-4 text-body",
};

export function SegmentedChoice<V extends string = string>({
  label,
  hideLabel,
  options,
  value,
  onChange,
  size = 40,
  disabled,
  helper,
  error,
  className = "",
}: SegmentedChoiceProps<V>) {
  const id = useId();
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === value);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + options.length) % options.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = options.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onChange(options[next].value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons[next]?.focus();
  };

  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-60" : ""} ${className}`}>
      <span id={`${id}-label`} className={hideLabel ? "sr-only" : "text-label uppercase text-muted"}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onKeyDown={onKeyDown}
        className={`inline-flex w-fit overflow-hidden rounded-sm border bg-surface ${error ? "border-danger" : "border-line"}`}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          const tabbable = selected || (value === null && index === 0);
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={tabbable ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={
                `${HEIGHT[size]} whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed ` +
                (index > 0 ? "border-l border-line " : "") +
                (selected
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-body hover:bg-canvas")
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-small text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
