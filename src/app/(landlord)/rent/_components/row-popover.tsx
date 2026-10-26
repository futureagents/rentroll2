"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

// The A2 data table scrolls inside its own container, so anything absolutely positioned in a row
// is clipped. L04-FRM-MARKPAID opens "in the row": this card is anchored to the row's button but
// rendered at body level, below the button (or above it when there is no room), right-aligned.
//
// PROMOTE: row popover — an anchored card for inline row forms; candidate addition to the A2
// Data table row (RowActions) if other boards need inline forms.
export function RowPopover({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const c = card.current?.getBoundingClientRect();
      if (!a || !c) return;
      const gap = 4;
      const below = a.bottom + gap;
      const top = below + c.height <= window.innerHeight ? below : Math.max(gap, a.top - gap - c.height);
      const left = Math.min(Math.max(gap, a.right - c.width), window.innerWidth - c.width - gap);
      setPosition({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={card}
      role="dialog"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
          anchor.current?.focus();
        }
      }}
      // Clicks inside must not reach the row underneath (it would open L-05).
      onClick={(event) => event.stopPropagation()}
      style={position ?? { top: 0, left: 0, visibility: "hidden" }}
      className="fixed z-40 w-80 max-w-[calc(100vw-8px)] rounded-md border border-line bg-surface p-4 text-left whitespace-normal shadow-2"
    >
      {children}
    </div>,
    document.body,
  );
}
