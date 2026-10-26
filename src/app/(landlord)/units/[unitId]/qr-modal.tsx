"use client";
// L09-BTN-QR: "Shows the unit QR in a modal with a print option". The code carries the unit's
// door token: report-only (D-02), the same between tenants. Print opens P-03 with this unit's
// one card (proposed decision; P-03's rules forbid printing the app's own interface). The door
// code can be replaced here, the only way to revoke it (D-01); that writes an audit event (D-14).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";

import { QrSvg } from "@/app/print/_lib/qr-svg";

import { regenerateDoorTokenAction } from "../actions";
import { Modal } from "../_components/modal";
import type { UnitView } from "./view";

export function QrModal({ view, open, onClose }: { view: UnitView; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacing, startReplace] = useTransition();

  const replace = () =>
    startReplace(async () => {
      const result = await regenerateDoorTokenAction(view.id);
      setConfirmReplace(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      toast.show({ message: "Door code replaced. Print a new sticker for this unit." });
      router.refresh();
    });

  return (
    <>
      <Modal
        open={open}
        title={`Door QR code · ${view.label}`}
        onClose={onClose}
        busy={replacing}
        footer={
          <>
            <Button variant="danger" onClick={() => setConfirmReplace(true)} className="sm:mr-auto">
              Replace code
            </Button>
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
            <Button icon="print" onClick={() => window.open(`/print/door-qr?units=${view.id}`, "_blank", "noopener")}>
              Print
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-2 rounded-md border border-line p-4">
          <QrSvg value={view.doorLink} sizeMm={48} label={`QR code: report a problem in ${view.label}`} />
          <p className="text-h2 text-ink">Scan to report a problem</p>
        </div>
        <p className="text-small text-muted">
          This code is for reporting problems only and stays the same between tenants. Share the tenant link for everything else.
        </p>
        {error && (
          <p role="alert" className="text-small text-danger">
            {error}
          </p>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmReplace}
        title="Replace the door code?"
        consequence="Printed stickers for this unit stop working at once. You will need to print and put up a new one."
        actionLabel="Replace code"
        destructive
        loading={replacing}
        onCancel={() => setConfirmReplace(false)}
        onConfirm={replace}
      />
    </>
  );
}
