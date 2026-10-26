"use client";
// PROMOTE: message composer — the minimum local version of S-01 for the three L-07 kinds
// (vendor_dispatch, tenant_update, payment_link). Replace with the S-01 lane's component when it
// lands; the integration contract is `confirmSent` in ../actions.ts.
//
// G-1: nothing leaves the app from here. The draft sits in an editable field; WhatsApp opens
// with the text pre-filled and the landlord presses send there. Only "Yes" to "Did you send it?"
// writes the message row (D-17). "Not yet" returns to the draft; Cancel writes nothing.
import { useState } from "react";

import { Button, ConfirmDialog, TextArea, useToast } from "@/components/ui";
import { copyText } from "@/components/ui/share";

import { confirmSent, type SentKind } from "../actions";
import { whatsAppLink } from "../_lib/drafts";
import { Modal } from "./local-ui";

/** E1-09: the assistant is not wired yet, so every draft here is the template (D-37). */
const TEMPLATE_NOTE = "Wrote this from a template — edit as needed.";

export interface ComposerRequest {
  kind: SentKind;
  /** S01-HDR: "Message to Suresh Khan · Flat 4C". */
  title: string;
  /** `+91XXXXXXXXXX`. */
  phone: string;
  draft: string;
  vendorId: string | null;
}

export function Composer({
  requestId,
  message,
  onClose,
  onRecorded,
}: {
  requestId: string;
  message: ComposerRequest | null;
  onClose: () => void;
  onRecorded: (kind: SentKind) => void;
}) {
  // Keyed by the parent on each open, so the draft starts fresh every time.
  const [text, setText] = useState(message?.draft ?? "");
  const [step, setStep] = useState<"compose" | "confirm">("compose");
  const [channel, setChannel] = useState<"whatsapp" | "copy">("whatsapp");
  const [askCancel, setAskCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  if (!message) return null;
  const edited = text !== message.draft;
  const empty = text.trim() === "";

  const cancel = () => (edited && step === "compose" ? setAskCancel(true) : onClose());

  const openWhatsApp = () => {
    window.open(whatsAppLink(message.phone, text), "_blank", "noopener,noreferrer");
    setChannel("whatsapp");
    setStep("confirm");
  };

  const copy = () => {
    copyText(text);
    toast.show({ message: "Copied.", duration: 2000 });
    setChannel("copy");
    setStep("confirm");
  };

  const recordSent = async () => {
    setSaving(true);
    setError(null);
    const result = await confirmSent({ requestId, kind: message.kind, channel, body: text, vendorId: message.vendorId });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onRecorded(message.kind);
  };

  return (
    <>
      <Modal
        open
        title={message.title}
        onClose={cancel}
        footer={
          step === "compose" ? (
            <>
              <Button variant="quiet" onClick={cancel}>
                Cancel
              </Button>
              {empty ? (
                <Button variant="secondary" icon="copy" disabled disabledReason="Write a message first">
                  Copy
                </Button>
              ) : (
                <Button variant="secondary" icon="copy" onClick={copy}>
                  Copy
                </Button>
              )}
              {empty ? (
                <Button icon="share" disabled disabledReason="Write a message first">
                  Open in WhatsApp
                </Button>
              ) : (
                <Button icon="share" onClick={openWhatsApp}>
                  Open in WhatsApp
                </Button>
              )}
            </>
          ) : (
            <>
              {saving ? (
                <Button variant="quiet" disabled disabledReason="Recording that you sent it">
                  Not yet
                </Button>
              ) : (
                <Button variant="quiet" onClick={() => setStep("compose")}>
                  Not yet
                </Button>
              )}
              <Button onClick={recordSent} loading={saving}>
                Yes
              </Button>
            </>
          )
        }
      >
        {step === "compose" ? (
          <div className="flex flex-col gap-2">
            <TextArea label="Message" value={text} onChange={setText} minLines={6} />
            <p className="text-small text-muted">{TEMPLATE_NOTE}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-h2 text-ink">Did you send it?</p>
            <p className="text-small text-muted">
              It is recorded on this request only when you say Yes. Not yet takes you back to the message.
            </p>
            {error ? (
              <p role="alert" className="text-small text-danger">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={askCancel}
        title="Discard this message?"
        consequence="Your edits to the message will be lost and nothing is recorded."
        actionLabel="Discard message"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setAskCancel(false)}
        onConfirm={() => {
          setAskCancel(false);
          onClose();
        }}
      />
    </>
  );
}
