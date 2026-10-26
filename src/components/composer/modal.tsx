"use client";
// PROMOTE: modal shell → A2 (new display-component row "Modal": 560px on desktop, full screen on
// mobile, radius-md, shadow-2). S-01 is the first modal in the product; ConfirmDialog is the only
// A2 dialog and is fixed to the question/consequence/action shape.
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
      className="m-0 h-full max-h-none w-full max-w-none bg-surface p-0 text-body backdrop:bg-ink/40 sm:m-auto sm:h-auto sm:max-h-[calc(100%-48px)] sm:w-[calc(100%-32px)] sm:max-w-[560px] sm:rounded-md sm:border sm:border-line sm:shadow-2"
    >
      {children}
    </dialog>
  );
}
