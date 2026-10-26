"use client";
// The client-side filter box on L-08 and L-10 (proposed decision in the lane PR: v1 has no global
// search, and a long list needs narrowing). Filters as the landlord types; Escape or the clear
// button empties it. The label is for screen readers; the placeholder says what it matches.
//
// PROMOTE: filter box — a search-style text field for A2 Form fields (L-13 and L-14 lists will
// want the same); belongs in src/components/ui beside TextField.
import { useId } from "react";

import { Button } from "@/components/ui";

export interface FilterBoxProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** "12 of 50 units" — announced politely as the list narrows. */
  summary?: string;
  className?: string;
}

export function FilterBox({ label, placeholder, value, onChange, summary, className = "" }: FilterBoxProps) {
  const id = useId();
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative w-full sm:w-80">
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && value) {
              event.preventDefault();
              onChange("");
            }
          }}
          className="h-10 w-full rounded-sm border border-line bg-surface px-3 pr-10 text-(length:--text-body) text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <span className="absolute inset-y-0 right-1 flex items-center">
            <Button variant="icon" icon="close" label="Clear filter" onClick={() => onChange("")} />
          </span>
        )}
      </div>
      {summary && (
        <p role="status" aria-live="polite" className="text-small text-muted">
          {summary}
        </p>
      )}
    </div>
  );
}
