"use client";
// PROMOTE: payment sheet — the minimum local version of S-02 for L15-FLD-UPI's "Test with ₹1" †.
// Replace with the S-02 lane's component when it lands (spec/screens/S-02.md); the local S-02 in
// maintenance/_components/payment-sheet.tsx is the other copy.
//
// The landlord pays ₹1 to the typed UPI ID from their own phone, so a wrong ID shows up now rather
// than when a tenant tries. S-02 rule: "The sheet never claims payment has been received" — the
// app never sees this payment, and says so.
import { useId } from "react";

import { useMediaQuery } from "@/components/shell/detail-panel-host";
import { Button, Modal } from "@/components/ui";
import { buildUpiLink } from "@/lib/upi";
import { QrSvg } from "@/app/print/_lib/qr-svg";

export const TEST_AMOUNT = 1;

export function UpiTestSheet({
  open,
  upiId,
  payeeName,
  onClose,
}: {
  open: boolean;
  upiId: string;
  payeeName: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const phone = useMediaQuery("(pointer: coarse)");
  const link = buildUpiLink({ upiId, payeeName, amount: TEST_AMOUNT, note: "RentRoll UPI ID test" });

  return (
    <Modal open={open} labelledBy={titleId} onDismiss={onClose}>
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-h2 text-ink">
          Test {upiId} with ₹1
        </h2>
        <ol className="flex list-decimal flex-col gap-1 pl-6 text-body">
          <li>{phone ? "Open your payment app below" : "Scan this code with any UPI app on your phone"}.</li>
          <li>Check the app shows your name, or the name your bank has for this ID, before you pay.</li>
          <li>Pay the ₹1. If it arrives in your account, tenants can pay you with this ID.</li>
        </ol>
        <div className="flex justify-center rounded-md border border-line bg-surface p-4">
          <QrSvg value={link} sizeMm={50} label={`UPI payment code for ₹1 to ${upiId}`} />
        </div>
        <p className="text-small text-muted">
          RentRoll never sees this payment. If the app says the ID cannot be found, check it for a typing mistake.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
          {phone ? (
            <Button onClick={() => window.location.assign(link)}>Open payment app</Button>
          ) : (
            <Button disabled disabledReason="Scan the code with your phone instead.">
              Open payment app
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
