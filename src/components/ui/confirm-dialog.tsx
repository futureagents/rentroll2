"use client";
// A2 · Confirm dialog. Title as a question, one line of consequence, cancel plus a labelled
// action button. The action button says what it does — "Delete unit", never "OK". Danger
// buttons always sit behind this dialog. Built on the native <dialog>, which traps focus,
// closes on Escape and returns focus to the trigger (E5).
import { useEffect, useId, useRef } from "react";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  /** Phrased as a question: "Delete this unit?" */
  title: string;
  /** One line: "Its tenants, rent history and documents will be removed." */
  consequence: string;
  /** Names the action: "Delete unit". Never "OK", "Yes" or "Confirm". */
  actionLabel: string;
  cancelLabel?: string;
  /** Renders the action as a danger button. */
  destructive?: boolean;
  /** Spinner on the action button while the call runs. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const FORBIDDEN_ACTION = /^(ok|okay|yes|confirm|continue|proceed)\.?$/i;

/** True for labels that do not name the action ("OK", "Yes", "Confirm"): A2 forbids them. */
export function isForbiddenActionLabel(label: string): boolean {
  return FORBIDDEN_ACTION.test(label.trim());
}

export function ConfirmDialog({
  open,
  title,
  consequence,
  actionLabel,
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (isForbiddenActionLabel(actionLabel)) {
    throw new Error(`ConfirmDialog action must name the action (A2), not "${actionLabel}".`);
  }
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
      aria-describedby={`${id}-body`}
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onCancel();
      }}
      onClick={(event) => {
        // Backdrop click: the dialog element itself is the target only outside its box.
        if (event.target === ref.current && !loading) onCancel();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[560px] rounded-md border border-line bg-surface p-0 text-body shadow-2 backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={`${id}-title`} className="text-h1 text-ink">
          {title}
        </h2>
        <p id={`${id}-body`} className="text-body">
          {consequence}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {loading ? (
            <Button variant="quiet" disabled disabledReason="Waiting for the action to finish">
              {cancelLabel}
            </Button>
          ) : (
            <Button variant="quiet" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
