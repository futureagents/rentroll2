"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { SidePanel } from "@/components/shell/detail-panel-host";
import {
  Button,
  ConfirmDialog,
  CopyButton,
  Dropdown,
  Icon,
  MoneyField,
  StatusChip,
  TextArea,
  Timeline,
  Tooltip,
  useToast,
} from "@/components/ui";
import { formatDate, formatPhone, formatRupees } from "@/lib/format";

import { editAmountAction, logCallAction, voidPaymentAction } from "../actions";
import type { IsoDate } from "../_lib/calendar";
import { panelTitle } from "../_lib/labels";
import { receiptLabel, validateAmountEdit } from "../_lib/payments";
import { deriveRentState, partPaidLine, rentChip, rowActions } from "../_lib/status";
import { CALL_OUTCOMES, buildReminderTimeline, reminderHistorySummary } from "../_lib/timeline";
import type { BoardEntry, BoardPayment, RentEntryDetail } from "../_lib/types";

import { MarkPaidForm } from "./mark-paid-form";

type Mode = "markPaid" | "logCall" | "edit" | null;

/** S-01 and S-02 belong to other lanes; until they land these buttons say why they cannot open. */
const COMPOSER_PENDING = "Reminders open the message composer, which is not available yet.";
const PAYSHEET_PENDING = "The payment sheet is not available yet.";

/**
 * L-05 Rent detail panel. `entry` comes from the board so the header shows at once; `detail`
 * (messages, audit events) arrives with the route and replaces the skeleton.
 */
export function RentPanel({
  entry,
  detail,
  multipleProperties,
  today,
  onClose,
}: {
  entry: BoardEntry;
  detail: RentEntryDetail | null;
  multipleProperties: boolean;
  today: IsoDate;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [voiding, setVoiding] = useState<BoardPayment | null>(null);
  const [voidPending, startVoid] = useTransition();
  const [askLogCall, setAskLogCall] = useState(false);
  const awaitingCall = useRef(false);
  const toast = useToast();

  const source = detail ?? entry;
  const state = deriveRentState({ amountDue: source.amountDue, dueOn: source.dueOn }, source.payments, today);
  const chip = rentChip(state);
  const part = partPaidLine(state);
  const actions = rowActions(state);

  // L05-SEC-TENANT call icon: "On return to the tab, a prompt appears: 'Log this call?'"
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible" && awaitingCall.current) {
        awaitingCall.current = false;
        setAskLogCall(true);
      }
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, []);

  const confirmVoid = () =>
    startVoid(async () => {
      if (!voiding) return;
      const result = await voidPaymentAction(voiding.id);
      setVoiding(null);
      toast.show({
        message: result.ok ? `Payment voided. Receipt ${voiding.receiptNumber} is kept as voided.` : result.error,
      });
    });

  const open = (next: Mode) => {
    setAskLogCall(false);
    setMode(mode === next ? null : next);
  };

  return (
    <SidePanel
      open
      onClose={onClose}
      title={panelTitle(source, multipleProperties)}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          {part ? <span className="text-small text-body">{part}</span> : null}
        </span>
      }
      dirty={mode !== null}
      footer={
        <>
          {actions.remind ? (
            <Button disabled disabledReason={COMPOSER_PENDING}>
              Send reminder
            </Button>
          ) : null}
          <Button variant="secondary" disabled disabledReason={PAYSHEET_PENDING}>
            Payment link
          </Button>
          {actions.markPaid ? (
            <Button variant="secondary" aria-expanded={mode === "markPaid"} onClick={() => open("markPaid")}>
              Mark paid
            </Button>
          ) : null}
          <Button variant="quiet" aria-expanded={mode === "logCall"} onClick={() => open("logCall")}>
            Log a call
          </Button>
          {actions.markPaid ? (
            <Button variant="quiet" aria-expanded={mode === "edit"} onClick={() => open("edit")}>
              Edit amount
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {askLogCall ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-canvas p-3">
            <p className="text-ink">Log this call?</p>
            <div className="flex gap-2">
              <Button variant="quiet" size={32} onClick={() => setAskLogCall(false)}>
                Not now
              </Button>
              <Button variant="secondary" size={32} onClick={() => open("logCall")}>
                Log call
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "markPaid" ? (
          <FormCard title="Mark paid">
            <MarkPaidForm rentEntryId={source.id} state={state} today={today} onDone={() => setMode(null)} onCancel={() => setMode(null)} />
          </FormCard>
        ) : null}
        {mode === "edit" ? (
          <FormCard title="Edit amount">
            <EditAmountForm rentEntryId={source.id} state={state} onDone={() => setMode(null)} />
          </FormCard>
        ) : null}
        {mode === "logCall" ? (
          <FormCard title="Log a call">
            <LogCallForm rentEntryId={source.id} onDone={() => setMode(null)} />
          </FormCard>
        ) : null}

        {/* L05-SEC-AMOUNT */}
        <section aria-labelledby="rent-amount" className="flex flex-col gap-3">
          <h3 id="rent-amount" className="text-label uppercase text-muted">
            Rent
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Pair term="Rent due">
              {formatRupees(state.due)}
              {source.isProRata ? <span className="ml-2 text-small text-muted">pro-rata</span> : null}
            </Pair>
            <Pair term="Amount paid">{formatRupees(state.paid)}</Pair>
            <Pair term="Due date">{formatDate(source.dueOn)}</Pair>
            {state.balance > 0 ? <Pair term="Pending">{formatRupees(state.balance)}</Pair> : null}
          </dl>
          {source.payments.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {source.payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 p-3">
                  <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1">
                    <Pair term="Receipt number">
                      <span className={p.status === "voided" ? "text-muted line-through" : ""}>{receiptLabel(p)}</span>
                    </Pair>
                    <Pair term="Amount">
                      <span className={p.status === "voided" ? "text-muted line-through" : ""}>{formatRupees(p.amount)}</span>
                    </Pair>
                    <Pair term="Date paid">{formatDate(p.receivedOn)}</Pair>
                    <Pair term="Payment reference">{p.reference ?? "—"}</Pair>
                  </dl>
                  {p.status === "recorded" ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="icon"
                        icon="print"
                        label={`Print receipt ${p.receiptNumber}`}
                        onClick={() => window.open(`/print/receipt/${p.id}`, "_blank", "noopener")}
                      />
                      <Button variant="danger" size={32} onClick={() => setVoiding(p)}>
                        Void
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* L05-SEC-TENANT */}
        <section aria-labelledby="rent-tenant" className="flex flex-col gap-2">
          <h3 id="rent-tenant" className="text-label uppercase text-muted">
            Tenant
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-ink">{source.tenantName}</span>
              <span className="text-small text-body tabular-nums">{formatPhone(source.tenantPhone)}</span>
            </div>
            {source.tenantPhone ? (
              <div className="flex items-center gap-1">
                <Tooltip label="Call">
                  <a
                    href={`tel:${source.tenantPhone}`}
                    aria-label={`Call ${source.tenantName}`}
                    onClick={() => {
                      awaitingCall.current = true;
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-body hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon name="call" />
                  </a>
                </Tooltip>
                {/* The message icon opens S-01 (user decision on the L-05 message-icon OPEN). */}
                <Button
                  variant="icon"
                  icon="note"
                  label={`Message ${source.tenantName}`}
                  disabled
                  disabledReason={COMPOSER_PENDING}
                />
                <CopyButton text={source.tenantPhone} label="Copy phone number" />
              </div>
            ) : null}
          </div>
        </section>

        {/* L05-TML-REMINDERS */}
        <section aria-labelledby="rent-history" className="flex flex-col gap-3">
          <h3 id="rent-history" className="text-label uppercase text-muted">
            Reminder history
          </h3>
          {detail ? (
            <>
              {detail.messages.length > 0 ? <p className="text-small text-muted">{reminderHistorySummary(detail.messages)}</p> : null}
              <Timeline events={buildReminderTimeline(detail.messages, detail.audits)} empty="No reminders or calls yet." />
            </>
          ) : (
            <Timeline events={[]} loading />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={voiding !== null}
        title={voiding ? `Void receipt ${voiding.receiptNumber}?` : ""}
        consequence={
          voiding
            ? `${formatRupees(voiding.amount)} will no longer count as paid. The receipt number is kept and shown as voided.`
            : ""
        }
        actionLabel="Void payment"
        destructive
        loading={voidPending}
        onCancel={() => setVoiding(null)}
        onConfirm={confirmVoid}
      />
    </SidePanel>
  );
}

function Pair({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-small text-muted">{term}</dt>
      <dd className="tabular-nums text-ink">{children}</dd>
    </div>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-md border border-line bg-canvas p-4">
      {children}
    </section>
  );
}

/** L05-BTN-EDIT (D-25): any edit is recorded on the timeline with the old and new value. */
function EditAmountForm({
  rentEntryId,
  state,
  onDone,
}: {
  rentEntryId: string;
  state: ReturnType<typeof deriveRentState>;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<number | null>(state.due);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const submit = () => {
    const problem = validateAmountEdit({ state, next: amount });
    if (problem) return setError(problem);
    startTransition(async () => {
      const result = await editAmountAction({ rentEntryId, next: amount! });
      if (!result.ok) return setError(result.error);
      toast.show({ message: `Amount due changed to ${formatRupees(amount!)}.` });
      onDone();
    });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <MoneyField
        label="Amount due"
        value={amount}
        onChange={setAmount}
        helper={state.paid > 0 ? `${formatRupees(state.paid)} already received.` : "For pro-rata or an agreed adjustment."}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button variant="quiet" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save amount
        </Button>
      </div>
    </form>
  );
}

/** L05-FRM-LOGCALL †: outcome and a note, saved as a reminder record with method "call". */
function LogCallForm({ rentEntryId, onDone }: { rentEntryId: string; onDone: () => void }) {
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const submit = () => {
    if (!outcome) return setError("Choose how the call went.");
    startTransition(async () => {
      const result = await logCallAction({ rentEntryId, outcome, note });
      if (!result.ok) return setError(result.error);
      toast.show({ message: "Reminder recorded on the tenant's history." }); // E1-02
      onDone();
    });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <Dropdown
        label="Outcome"
        placeholder="Choose an outcome"
        value={outcome}
        onChange={setOutcome}
        options={CALL_OUTCOMES.map((o) => ({ value: o.value, label: o.label }))}
      />
      <TextArea label="Note" helper="Optional" value={note} onChange={setNote} />
      <div className="flex justify-end gap-2">
        <Button variant="quiet" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save call
        </Button>
      </div>
    </form>
  );
}
