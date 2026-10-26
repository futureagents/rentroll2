"use client";
// PROMOTE: payment sheet — the minimum local version of S-02 for L07-BTN-PAYREQUEST †
// ("opens S-02 with the cost pre-filled"). Replace with the S-02 lane's component when it lands.
//
// D-27: the link is a plain UPI intent URL; there is no hosted payment page, so no tenant-facing
// screen shows the figure. The amount leaves the app only inside a message the landlord reads and
// sends through S-01 (G-1). S-02 rule: "The sheet never claims payment has been received."
import Link from "next/link";
import { useState } from "react";

import { useMediaQuery } from "@/components/shell/detail-panel-host";
import { Button, MoneyField, TextField, useToast } from "@/components/ui";
import { copyText } from "@/components/ui/share";
import { QrSvg } from "@/app/print/_lib/qr-svg";

import { UPI_NOTE_MAX, buildPaymentLink } from "../_lib/drafts";
import { Modal } from "./local-ui";

export interface PaymentSheetRequest {
  amount: number | null;
  note: string;
  payee: { upiId: string; name: string } | null;
}

export function PaymentSheet({
  sheet,
  onClose,
  onSendLink,
}: {
  sheet: PaymentSheetRequest;
  onClose: () => void;
  onSendLink: (link: string, amount: number) => void;
}) {
  const [amount, setAmount] = useState<number | null>(sheet.amount);
  const [note, setNote] = useState(sheet.note);
  const phone = useMediaQuery("(pointer: coarse)");
  const toast = useToast();

  const payee = sheet.payee;
  const ready = payee !== null && amount !== null && amount > 0;
  const link = ready ? buildPaymentLink({ upiId: payee.upiId, payeeName: payee.name, amount, note }) : null;

  return (
    <Modal open title="Payment request" onClose={onClose} footer={
      link && amount ? (
        <>
          <Button variant="secondary" icon="copy" onClick={() => { copyText(link); toast.show({ message: "Copied.", duration: 2000 }); }}>
            Copy link
          </Button>
          <Button variant="secondary" icon="share" onClick={() => onSendLink(link, amount)}>
            Send link
          </Button>
          {phone ? (
            <Button onClick={() => window.location.assign(link)}>Open payment app</Button>
          ) : (
            <Button disabled disabledReason="Scan the code with your phone instead.">
              Open payment app
            </Button>
          )}
        </>
      ) : undefined
    }>
      {payee === null ? (
        <div className="flex flex-col gap-3">
          <p>Add your UPI ID before sending a payment request.</p>
          <Link href="/settings" className="text-primary underline underline-offset-2">
            Go to settings
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <MoneyField label="Amount" value={amount} onChange={setAmount} required />
          <TextField
            label="Note"
            value={note}
            onChange={setNote}
            maxLength={UPI_NOTE_MAX}
            helper="Shown in the tenant's payment app."
          />
          {link ? (
            <div className="flex justify-center rounded-md border border-line bg-surface p-4">
              <QrSvg value={link} sizeMm={50} label="Payment QR code" />
            </div>
          ) : (
            <p className="text-small text-muted">Enter an amount to make the payment code.</p>
          )}
          <p className="text-small text-muted">This sends a request only. Mark the payment yourself when it arrives.</p>
        </div>
      )}
    </Modal>
  );
}
