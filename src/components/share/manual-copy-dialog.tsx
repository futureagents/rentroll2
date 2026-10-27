"use client";
// S-03 · What happens when the browser refuses: the clipboard write was blocked, or the share sheet
// would not open. Instead of a toast that claims a copy that never happened, the text is shown
// selected so it can be copied by hand, with one more copy attempt on a fresh click.
// PROMOTE: manual-copy fallback dialog → A2 S-03 share and copy (with share-action.tsx).
import { useEffect, useId, useRef } from "react";

import { Button, Modal } from "@/components/ui";

import { startCopy, type SharePlatform } from "./platform";

export type ManualCopyReason = "clipboard" | "share";

export interface ManualCopyDialogProps {
  open: boolean;
  /** Why it opened: the clipboard was blocked, or the share sheet did not open. */
  reason: ManualCopyReason;
  value: string;
  /** "Tenant link", "UPI ID". */
  what: string;
  platform: SharePlatform;
  onCopied: () => void;
  onClose: () => void;
}

const LEAD: Record<ManualCopyReason, string> = {
  clipboard: "This browser did not allow copying, so the text is selected below.",
  share: "The share sheet did not open here, so the text is selected below.",
};

export function ManualCopyDialog({ open, reason, value, what, platform, onCopied, onClose }: ManualCopyDialogProps) {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  const selectAll = () => {
    field.current?.focus();
    field.current?.select();
  };

  useEffect(() => {
    if (open) selectAll();
  }, [open]);

  const retry = () => {
    // A new click is a new gesture, so one more attempt can succeed (the page regained focus,
    // permission was granted). Started before any await; a second refusal leaves the text selected.
    startCopy(value, platform).then((copied) => (copied ? onCopied() : selectAll()));
  };

  return (
    <Modal open={open} labelledBy={`${id}-title`} onDismiss={onClose}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <h2 id={`${id}-title`} className="text-h1 text-ink">
          Copy the {what.toLowerCase()}
        </h2>
        <p className="text-body">
          {LEAD[reason]} Press Ctrl+C, or ⌘C on a Mac. On a phone, press and hold it.
        </p>
        <textarea
          ref={field}
          readOnly
          rows={3}
          value={value}
          aria-label={what}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full resize-none rounded-sm border border-line bg-canvas p-3 text-small break-all text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" icon="copy" onClick={retry}>
            Try copying again
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
