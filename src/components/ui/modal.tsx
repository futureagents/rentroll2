"use client";
// A2 · Modal. A content shell: 560px on desktop, full screen on mobile, radius-md, shadow-2. The
// caller supplies the title (wired by `labelledBy`), body and actions; ConfirmDialog stays the
// fixed question/consequence/action shape. Promoted from S-01's composer.
// Built on the native <dialog>, which traps focus and returns it to the trigger (E5). Escape and
// the backdrop call onDismiss so the composer can confirm before discarding edits.
import { useEffect, useRef, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  labelledBy: string;
  onDismiss: () => void;
  children: ReactNode;
}

export function Modal({ open, labelledBy, onDismiss, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onDismiss();
      }}
      className="m-auto max-h-[calc(100%-48px)] w-[calc(100%-32px)] max-w-[560px] rounded-md border border-line bg-surface p-0 text-body shadow-2 backdrop:bg-ink/40 max-sm:m-0 max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
    >
      {children}
    </dialog>
  );
}
