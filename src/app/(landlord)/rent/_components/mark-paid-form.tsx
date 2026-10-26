"use client";

import { useState, useTransition } from "react";

import { Button, DateField, MoneyField, TextField } from "@/components/ui";
import { formatRupees } from "@/lib/format";

import { markPaidAction } from "../actions";
import type { IsoDate } from "../_lib/calendar";
import { markPaidDefaults, validatePayment } from "../_lib/payments";
import type { RentState } from "../_lib/status";

import { usePaymentToast } from "./payment-toast";

/**
 * L04-FRM-MARKPAID †, also used by L05-BTN-MARKPAID (D-10). Amount received pre-filled with the
 * balance, date received defaulting to today, optional reference. Recording less than the
 * balance is a part payment: it gets its own receipt and Mark paid stays for the rest.
 */
export function MarkPaidForm({
  rentEntryId,
  state,
  today,
  onDone,
  onCancel,
}: {
  rentEntryId: string;
  state: RentState;
  today: IsoDate;
  onDone: () => void;
  onCancel: () => void;
}) {
  const defaults = markPaidDefaults(state, today);
  const [amount, setAmount] = useState<number | null>(defaults.amount);
  const [receivedOn, setReceivedOn] = useState(defaults.receivedOn);
  const [reference, setReference] = useState(defaults.reference);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const announce = usePaymentToast();

  const submit = () => {
    const problem = validatePayment({ amount, receivedOn, balance: state.balance, today });
    if (problem) return setError(problem);
    setError(null);
    startTransition(async () => {
      const result = await markPaidAction({ rentEntryId, amount: amount!, receivedOn, reference });
      if (!result.ok) return setError(result.error);
      announce(result.payments);
      onDone();
    });
  };

  const part = amount !== null && amount > 0 && amount < state.balance;

  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Mark paid"
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
        label="Amount received"
        value={amount}
        onChange={setAmount}
        helper={
          part
            ? `Part payment. ${formatRupees(state.balance - amount!)} will still be pending.`
            : state.partPaid
              ? `${formatRupees(state.balance)} still due.`
              : undefined
        }
        autoFocus
      />
      <DateField label="Date received" value={receivedOn} onChange={setReceivedOn} max={today} />
      <TextField label="Payment reference" helper="Optional" value={reference} onChange={setReference} />
      <div className="flex justify-end gap-2">
        <Button variant="quiet" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Record payment
        </Button>
      </div>
    </form>
  );
}
