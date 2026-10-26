"use client";
// L-09's four tabs (L09-TAB-OVERVIEW, L09-TAB-RENT, L09-TAB-MAINT, L09-TAB-PHOTOS). WAI-ARIA tabs:
// arrow keys move between tabs, the active tab has the primary-soft background (A1), and every
// panel stays mounted so a half-filled upload survives switching tabs.
//
// PROMOTE: tabs — the source names a TAB element type but A2 has no tab component; this should
// become one in src/components/ui.
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<V extends string> {
  value: V;
  label: string;
  panel: ReactNode;
}

export function Tabs<V extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.value === value);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onChange(items[next].value);
    listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              id={`${id}-tab-${item.value}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              className={
                "-mb-px h-10 shrink-0 whitespace-nowrap rounded-t-sm border-b-2 px-4 text-(length:--text-body) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary " +
                (selected ? "border-primary bg-primary-soft font-medium text-primary" : "border-transparent text-body hover:bg-canvas")
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.value}
          id={`${id}-panel-${item.value}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${item.value}`}
          hidden={item.value !== value}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
