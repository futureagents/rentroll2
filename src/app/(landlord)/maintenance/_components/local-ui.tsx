"use client";
// Minimum local versions of two A2 pieces L-07 needs and the library does not have yet.
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui";

// PROMOTE: checkbox — A2 "Form fields" row (L07-CHK-TENANTLIABLE, L07-CHK-NOCOST †, S01-CHK-PAYLINK).
export function Checkbox({
  label,
  checked,
  onChange,
  helper,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helper?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-60" : ""}`}>
      <label htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-2 text-ink">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={helper ? `${id}-helper` : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {label}
      </label>
      {helper ? (
        <p id={`${id}-helper`} className="text-small text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

// PROMOTE: modal — A2 modal (560px desktop, full screen on mobile) used by S-01 and S-02.
// Native <dialog>: traps focus, Escape closes, focus returns to the trigger (E5).
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-surface p-0 text-body shadow-2 backdrop:bg-ink/40 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-48px)] sm:w-[560px] sm:rounded-md sm:border sm:border-line"
    >
      <div className="flex h-full flex-col sm:max-h-[calc(100dvh-48px)]">
        <header className="flex items-start justify-between gap-4 border-b border-line p-4 sm:p-6">
          <h2 id={`${id}-title`} className="text-h1 text-ink">
            {title}
          </h2>
          <Button variant="icon" icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:flex-wrap sm:justify-end sm:p-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
