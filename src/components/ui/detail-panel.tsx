"use client";
// A2 · Detail panel. Slides in from the right, 480px wide on desktop, full screen on mobile.
// Closes on Escape, on backdrop click, and on the close button. Warns before closing if a
// field has unsaved edits. Traps focus and returns it to the trigger on close (E5).
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";

export interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Line under the title, e.g. unit and tenant. */
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky action row at the bottom. */
  footer?: ReactNode;
  /** True while a field has unsaved edits; closing then asks first. */
  dirty?: boolean;
  /** E3 skeleton while the record loads. */
  loading?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  dirty,
  loading,
}: DetailPanelProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);

  // Mount immediately when opened (state adjusted during render, not in an effect).
  if (open && !mounted) setMounted(true);

  // Animate in on the next frame; animate out, then unmount after the transition.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    const frame = requestAnimationFrame(() => setShown(false));
    const timer = window.setTimeout(() => setMounted(false), 200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open]);

  // Move focus in on open; return it to the trigger on close.
  useEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    return () => {
      triggerRef.current?.focus?.();
    };
  }, [mounted]);

  const requestClose = useCallback(() => {
    if (dirty) setAskDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onKeyDown={onKeyDown}>
        <div
          aria-hidden="true"
          onClick={requestClose}
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          tabIndex={-1}
          className={`absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-2 transition-transform duration-200 focus:outline-none sm:w-[480px] ${shown ? "translate-x-0" : "translate-x-full"}`}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line p-4 lg:p-6">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={`${id}-title`} className="text-h1 text-ink">
                {title}
              </h2>
              {subtitle && <p className="text-small text-muted">{subtitle}</p>}
            </div>
            <Button variant="icon" icon="close" label="Close" onClick={requestClose} />
          </header>
          <div className="flex-1 overflow-y-auto p-4 lg:p-6" aria-busy={loading || undefined}>
            {loading ? <PanelSkeleton /> : children}
          </div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-line p-4 lg:p-6">{footer}</footer>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={askDiscard}
        title="Discard your changes?"
        consequence="The edits in this panel have not been saved."
        actionLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setAskDiscard(false)}
        onConfirm={() => {
          setAskDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status">
      <span className="sr-only">Loading</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <span className="h-3 w-20 animate-pulse rounded-sm bg-line" />
          <span className="h-4 w-2/3 animate-pulse rounded-sm bg-line" />
        </div>
      ))}
    </div>
  );
}
