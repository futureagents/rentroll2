"use client";
// A modal with free content: the L09-BTN-QR code view, and the End tenancy confirmation, which
// must ask for a move-out date (D-05) and so cannot be the A2 Confirm dialog's single line.
// Native <dialog>, like the A2 Confirm dialog: traps focus, closes on Escape and on the backdrop,
// returns focus to the trigger (E5).
//
// PROMOTE: modal — a content modal for A2 Display components (the Confirm dialog with a body
// slot); belongs in src/components/ui.
import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  busy,
}: {
  open: boolean;
  /** Phrased as a question when the modal confirms an action (A2). */
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** While an action runs, Escape and the backdrop do nothing. */
  busy?: boolean;
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
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onClose();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[560px] rounded-md border border-line bg-surface p-0 text-body shadow-2 backdrop:bg-ink/40"
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={`${id}-title`} className="text-h1 text-ink">
            {title}
          </h2>
          {children}
          {footer && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
