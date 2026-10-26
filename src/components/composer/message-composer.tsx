"use client";
// S-01 · Message composer. The single place where an outgoing message is reviewed and handed
// off (G-1). The assistant (or a template) drafts into an editable field; nothing leaves until
// the landlord presses Open in WhatsApp, Copy or Email instead, and nothing is recorded until
// they answer "Did you send it?" → Yes (D-17). Opened with an id only; the server computes the
// pre-selected tone from days overdue capped by confirmed contacts (D-41).
import Link from "next/link";
import { useContext, useEffect, useId, useReducer, useRef, useState } from "react";

import { Button, Checkbox, ConfirmDialog, Modal, SegmentedChoice, StatusChip, TextArea } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { COPIED_MESSAGE, COPIED_MS } from "@/components/ui/share";
import { ToastContext, ToastView } from "@/components/ui/toast";
import { formatMonth } from "@/lib/format";

import { confirmSent, openComposer } from "./actions";
import { rentContextChips } from "./context-line";
import { requestDraft } from "./draft";
import { handOff, outgoingText } from "./handoff";
import { levelForTone, TONES, toneForLevel, type Tone } from "./ladder";
import { initialState, reduce } from "./machine";
import type { ComposerContext, ComposerTarget, LoadResult, SendChannel } from "./types";

/** E1-02: shown after "Yes" is recorded. */
export const REMINDER_LOGGED_MESSAGE = "Reminder recorded on the tenant's history.";
/** E1-09: the draft came from a template. */
export const TEMPLATE_NOTE = "Wrote this from a template — edit as needed.";
/** E1-07. */
const SAVE_FAILED = "Could not save. Your changes are still here — try again.";

export interface MessageComposerProps {
  /** Null keeps the composer closed. */
  target: ComposerTarget | null;
  /** `recorded` is true only when "Yes" wrote a message row; the opener refreshes its row then. */
  onClose: (result: { recorded: boolean }) => void;
}

export function MessageComposer({ target, onClose }: MessageComposerProps) {
  if (!target) return null;
  return <ComposerSession key={target.rentEntryId} target={target} onClose={onClose} />;
}

/**
 * Dev gallery only (src/app/dev/composer): the composer with fixture context instead of a load.
 * Drafting and "Yes" still go through the real server functions.
 */
export function MessageComposerPreview({
  context,
  onClose,
}: {
  context: ComposerContext;
  onClose: MessageComposerProps["onClose"];
}) {
  return <Composer context={context} onClose={onClose} />;
}

function ComposerSession({ target, onClose }: { target: ComposerTarget; onClose: MessageComposerProps["onClose"] }) {
  const [load, setLoad] = useState<LoadResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const titleId = useId();

  useEffect(() => {
    let live = true;
    openComposer(target)
      .then((result) => live && setLoad(result))
      .catch(() => live && setLoad({ ok: false, reason: "failed" }));
    return () => {
      live = false;
    };
  }, [target, attempt]);

  if (load?.ok) return <Composer context={load.context} onClose={onClose} />;

  const close = () => onClose({ recorded: false });
  return (
    <Modal open labelledBy={titleId} onDismiss={close}>
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} tabIndex={-1} autoFocus className="text-h1 text-ink focus:outline-none">
          {load === null ? "Preparing the message" : "Message"}
        </h2>
        {load === null ? (
          <DraftSkeleton />
        ) : (
          <p role="alert" className="text-body">
            {load.reason === "not_found"
              ? "Not found."
              : load.reason === "paid"
                ? "This month's rent is already paid."
                : "Could not load this message. Try again."}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {load && !load.ok && load.reason === "failed" && (
            <Button
              variant="secondary"
              onClick={() => {
                setLoad(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          )}
          <Button variant="quiet" onClick={close}>
            {load === null ? "Cancel" : "Close"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Composer({ context, onClose }: { context: ComposerContext; onClose: MessageComposerProps["onClose"] }) {
  const [state, dispatch] = useReducer(
    reduce,
    initialState(toneForLevel(context.preselectedLevel), context.payLink !== null),
  );
  const [copiedAt, setCopiedAt] = useState(0);
  const toast = useContext(ToastContext);
  const titleId = useId();

  // Draft on open, on a tone change and on "Write it differently". A late answer for an older
  // request is ignored by the machine.
  const { phase, tone, variant, draftRequest } = state;
  useEffect(() => {
    if (phase !== "drafting") return;
    let live = true;
    requestDraft(context, tone, variant).then((draft) => {
      if (live) dispatch({ type: "drafted", text: draft.text, source: draft.source, request: draftRequest });
    });
    return () => {
      live = false;
    };
  }, [phase, tone, variant, draftRequest, context]);

  const closed = useRef(false);
  useEffect(() => {
    if (phase !== "closed" || closed.current) return;
    closed.current = true; // once, even if the opener passes a new onClose on re-render
    onClose({ recorded: state.recorded });
  }, [phase, state.recorded, onClose]);

  useEffect(() => {
    if (!copiedAt) return;
    const timer = window.setTimeout(() => setCopiedAt(0), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copiedAt]);

  const payLink = state.includePayLink ? context.payLink : null;
  const level = levelForTone(state.tone);
  const chips = rentContextChips({ ...context, level });
  const header = `Message to ${context.recipient.name} · ${context.unitLabel}`;
  const ready = phase === "editing" && state.text.trim() !== "";
  const notReadyReason = phase === "drafting" ? "Waiting for the draft" : "Write a message first";

  // S01-BTN-WHATSAPP / S01-BTN-COPY / S01-BTN-EMAIL: hand off synchronously inside the click
  // (browsers block window.open and clipboard writes after an await), then ask.
  const send = (channel: SendChannel) => {
    if (!ready) return;
    const text = outgoingText(state.text, payLink);
    const subject = `Rent for ${formatMonth(context.month)} — ${context.unitLabel}`;
    if (!handOff(channel, { phone: context.recipient.phone, email: context.recipient.email, subject }, text)) return;
    if (channel === "copy") setCopiedAt(Date.now()); // E1-03
    dispatch({ type: "handedOff", channel, sendId: crypto.randomUUID() });
  };

  const yes = () => {
    if (phase !== "confirming" || !state.channel || !state.sendId) return;
    const body = outgoingText(state.text, payLink);
    dispatch({ type: "yes" });
    confirmSent({
      sendId: state.sendId,
      rentEntryId: context.rentEntryId,
      tone: state.tone,
      channel: state.channel,
      body,
    })
      .then((result) => {
        if (!result.ok) return dispatch({ type: "saveFailed" });
        dispatch({ type: "saved" });
        toast?.show({ message: REMINDER_LOGGED_MESSAGE }); // E1-02
      })
      .catch(() => dispatch({ type: "saveFailed" }));
  };

  const confirming = phase === "confirming" || phase === "saving";

  return (
    <Modal open labelledBy={titleId} onDismiss={() => dispatch({ type: "cancel" })}>
      <div className="flex h-full flex-col">
        {/* S01-HDR */}
        {/* Focus lands on the title, so the dialog is announced before the field. */}
        <div className="border-b border-line px-6 py-4">
          <h2 id={titleId} tabIndex={-1} autoFocus className="text-h1 text-ink focus:outline-none">
            {header}
          </h2>
        </div>

        {confirming ? (
          // S01-STATE-CONFIRMSEND
          <div className="flex flex-1 flex-col gap-4 px-6 py-6">
            <p className="text-h2 text-ink">Did you send it?</p>
            {state.saveFailed && (
              <p role="alert" className="text-small text-danger">
                {SAVE_FAILED}
              </p>
            )}
            <div className="mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {phase === "saving" ? (
                <Button variant="quiet" disabled disabledReason="Saving the reminder">
                  Not yet
                </Button>
              ) : (
                <Button variant="quiet" onClick={() => dispatch({ type: "notYet" })}>
                  Not yet
                </Button>
              )}
              <Button variant="primary" onClick={yes} loading={phase === "saving"}>
                Yes
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            {/* S01-CHP-CONTEXT */}
            <div className="flex flex-wrap gap-2" aria-label="Context">
              {chips.map((chip) => (
                <StatusChip key={chip} tone={chip === "Rent" ? "primary" : "neutral"}>
                  {chip}
                </StatusChip>
              ))}
            </div>

            {/* S01-BNR-STALE (D-41) */}
            {context.staleNote && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-sm border border-warning bg-warning/12 px-3 py-2 text-small text-ink"
              >
                <Icon name="warning" className="mt-1 shrink-0 text-warning" />
                <span>{context.staleNote}</span>
              </p>
            )}

            {/* S01-SEG-TONE */}
            <SegmentedChoice<Tone>
              label="Tone"
              options={TONES}
              value={state.tone}
              onChange={(next) => dispatch({ type: "chooseTone", tone: next })}
              disabled={phase === "drafting"}
            />

            {/* S01-FLD-MESSAGE: a normal editable field, not a preview. */}
            {phase === "drafting" ? (
              <div className="flex flex-col gap-1">
                <span className="text-label uppercase text-muted">Message</span>
                <DraftSkeleton />
              </div>
            ) : (
              <TextArea
                label="Message"
                value={state.text}
                onChange={(text) => dispatch({ type: "edit", text })}
                minLines={6}
                helper={state.source === "template" ? TEMPLATE_NOTE : undefined}
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* S01-BTN-REGENERATE */}
              {phase === "editing" ? (
                <Button variant="quiet" size={32} onClick={() => dispatch({ type: "regenerate" })}>
                  Write it differently
                </Button>
              ) : (
                <Button variant="quiet" size={32} disabled disabledReason={notReadyReason}>
                  Write it differently
                </Button>
              )}
              {state.restorable !== null && phase === "editing" && (
                <Button variant="quiet" size={32} onClick={() => dispatch({ type: "restore" })}>
                  Restore my edits
                </Button>
              )}
            </div>

            {/* S01-CHK-PAYLINK: rent kinds only; disabled with a link to L-15 without a UPI ID (D-38). */}
            <Checkbox
              label="Include a payment link"
              checked={payLink !== null}
              disabled={context.payLink === null || phase !== "editing"}
              onChange={(on) => dispatch({ type: "togglePayLink", on })}
              helper={
                context.payLink === null ? (
                  <>
                    Add your UPI ID in{" "}
                    <Link href="/settings" className="text-primary underline underline-offset-2">
                      Settings
                    </Link>{" "}
                    to include a payment link.
                  </>
                ) : payLink ? (
                  <span className="break-all">Added at the end: Pay by UPI: {payLink}</span>
                ) : undefined
              }
            />
          </div>
        )}

        {!confirming && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
            {/* S01-BTN-CANCEL */}
            <Button variant="quiet" onClick={() => dispatch({ type: "cancel" })}>
              Cancel
            </Button>
            {/* S01-BTN-EMAIL: only when an email address exists. */}
            {context.recipient.email &&
              (ready ? (
                <Button variant="quiet" onClick={() => send("email")}>
                  Email instead
                </Button>
              ) : (
                <Button variant="quiet" disabled disabledReason={notReadyReason}>
                  Email instead
                </Button>
              ))}
            {/* S01-BTN-COPY */}
            {ready ? (
              <Button variant="secondary" onClick={() => send("copy")}>
                Copy
              </Button>
            ) : (
              <Button variant="secondary" disabled disabledReason={notReadyReason}>
                Copy
              </Button>
            )}
            {/* S01-BTN-WHATSAPP */}
            {ready ? (
              <Button variant="primary" onClick={() => send("whatsapp")}>
                Open in WhatsApp
              </Button>
            ) : (
              <Button variant="primary" disabled disabledReason={notReadyReason}>
                Open in WhatsApp
              </Button>
            )}
          </div>
        )}
      </div>

      {/* E1-03 inside the dialog: the page's toast sits under the modal's top layer. */}
      {copiedAt > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
          <ToastView message={COPIED_MESSAGE} />
        </div>
      )}

      <ConfirmDialog
        open={state.pendingTone !== null}
        title="Change the tone?"
        consequence="This will replace your edits."
        actionLabel="Replace edits"
        cancelLabel="Keep my edits"
        onConfirm={() => dispatch({ type: "replaceEdits" })}
        onCancel={() => dispatch({ type: "keepEdits" })}
      />
      <ConfirmDialog
        open={state.confirmingCancel}
        title="Discard this message?"
        consequence="Nothing will be recorded and your edits will be lost."
        actionLabel="Discard message"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => dispatch({ type: "discard" })}
        onCancel={() => dispatch({ type: "keepEditing" })}
      />
    </Modal>
  );
}

/** E3: skeleton lines inside the text area while the draft is requested. */
function DraftSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Writing the draft"
      className="flex flex-col gap-2 rounded-sm border border-line bg-surface px-3 py-3"
    >
      <span className="h-3 w-11/12 animate-pulse rounded-sm bg-line" />
      <span className="h-3 w-10/12 animate-pulse rounded-sm bg-line" />
      <span className="h-3 w-9/12 animate-pulse rounded-sm bg-line" />
      <span className="h-3 w-6/12 animate-pulse rounded-sm bg-line" />
    </div>
  );
}

