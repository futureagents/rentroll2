"use client";

import { useCallback } from "react";

import { useToast } from "@/components/ui";

import { undoPaymentsAction } from "../actions";
import { PAYMENT_UNDO_MS, paymentRecordedMessage } from "../_lib/payments";

/**
 * E1-01 toast after Mark paid or bulk mark-paid, with an Undo that voids what was just recorded
 * (D-11). The toast is held for the full 10-second Undo window rather than A2's 4 seconds, so
 * the only Undo affordance never disappears while Undo is still live. After that the payment is
 * voided from L-05 instead.
 */
export function usePaymentToast() {
  const toast = useToast();
  return useCallback(
    (payments: { id: string; receiptNumber: string }[]) => {
      const receipts = payments.map((p) => p.receiptNumber);
      toast.show({
        message: paymentRecordedMessage(receipts),
        duration: PAYMENT_UNDO_MS,
        undo: {
          onUndo: async () => {
            const result = await undoPaymentsAction(payments.map((p) => p.id));
            toast.show({
              message: result.ok
                ? receipts.length === 1
                  ? `Payment undone. Receipt ${receipts[0]} is kept as voided.`
                  : `${receipts.length} payments undone. Their receipts are kept as voided.`
                : result.error,
            });
          },
        },
      });
    },
    [toast],
  );
}
