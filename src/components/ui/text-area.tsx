"use client";
// A2 · Text area. Auto-grows to 8 lines then scrolls. A character counter appears once the
// text passes 400 characters. Validates on blur.
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { controlClasses, FieldShell, REQUIRED_MESSAGE, useBlurValidation } from "./field";

const MAX_LINES = 8;
const COUNTER_FROM = 400;

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string | null;
  validate?: (value: string) => string | null | undefined;
  /** Starting height in lines; 3 by default. */
  minLines?: number;
}

export function TextArea({
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
  minLines = 3,
  maxLength,
  ...rest
}: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const blur = useBlurValidation(value, validate, required ? REQUIRED_MESSAGE : null);
  const shown = error ?? blur.error;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const style = window.getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const max = lineHeight * MAX_LINES + padding + border;
    const min = lineHeight * minLines + padding + border;
    element.style.height = "auto";
    const wanted = Math.max(min, element.scrollHeight + border);
    element.style.height = `${Math.min(wanted, max)}px`;
    element.style.overflowY = wanted > max ? "auto" : "hidden";
  }, [value, minLines]);

  const count = value.length;
  const counter =
    count > COUNTER_FROM ? (maxLength ? `${count} / ${maxLength}` : `${count} characters`) : undefined;

  return (
    <FieldShell
      label={label}
      helper={helper}
      error={shown}
      required={required}
      disabled={disabled}
      className={className}
      aside={counter}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          rows={minLines}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            blur.onBlur();
            onBlur?.(event);
          }}
          className={controlClasses(invalid, "h-auto resize-none py-2 leading-5")}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
