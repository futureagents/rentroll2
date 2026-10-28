"use client";
// L15-SEC-PAYMENT †: L15-FLD-UPI (with "Test with ₹1" †), L15-FLD-RECEIPTNAME, L15-UPL-LOGO and
// L15-UPL-SIGNATURE † (D-56). Each image goes up through S-04 (one photo, D-15) as soon as it is
// picked and is attached only when this section is saved, replacing the previous one. The receipt
// preview follows what is typed and picked, so the landlord sees the printed result before saving.
import { useEffect, useRef, useState } from "react";

import { Button, TextField } from "@/components/ui";
import { UPLOAD_MESSAGES } from "@/components/upload";
import {
  CHECK_FIELDS,
  displayReceiptName,
  parsePayment,
  receiptNameProblem,
  upiProblem,
  type ImageKind,
  type LandlordSettings,
  type PaymentField,
  type PaymentInput,
} from "@/lib/settings";

import { savePaymentAction } from "./actions";
import { ImageSlotField, useImageSlot } from "./_components/image-slot";
import { ReceiptPreview } from "./_components/receipt-preview";
import { SettingsSection, useSectionSave } from "./_components/section";
import { UpiTestSheet } from "./_components/upi-test-sheet";

interface Values {
  upiId: string;
  receiptName: string;
}

export function PaymentSection({
  settings,
  imageUrls,
  onDirtyChange,
}: {
  settings: LandlordSettings;
  /** Short-lived URLs of the saved logo and signature; refreshed by the page after every save. */
  imageUrls: Record<ImageKind, string | null>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [baseline, setBaseline] = useState<Values>(() => ({
    upiId: settings.upiId ?? "",
    receiptName: settings.receiptName ?? "",
  }));
  const [values, setValues] = useState(baseline);
  /** What the last save sent: edits typed while it was in flight stay unsaved. */
  const submitted = useRef(baseline);
  const [testing, setTesting] = useState(false);
  const logo = useImageSlot("logo", imageUrls.logo, "Your logo");
  const signature = useImageSlot("signature", imageUrls.signature, "Your signature");

  const dirty =
    values.upiId.trim() !== baseline.upiId.trim() ||
    values.receiptName.trim() !== baseline.receiptName.trim() ||
    logo.change.action !== "keep" ||
    signature.change.action !== "keep";
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const { status, fieldErrors, save, edited } = useSectionSave<PaymentField>({
    save: async () => {
      const [logoNow, signatureNow] = await Promise.all([logo.settle(), signature.settle()]);
      if (!logoNow.ok || !signatureNow.ok) {
        const fieldErrors: Partial<Record<PaymentField, string>> = {};
        if (!logoNow.ok) fieldErrors.logo = logoNow.error;
        if (!signatureNow.ok) fieldErrors.signature = signatureNow.error;
        return { ok: false, error: CHECK_FIELDS, fieldErrors };
      }
      const input: PaymentInput = { ...values, logo: logoNow.change, signature: signatureNow.change };
      const parsed = parsePayment(input);
      if (!parsed.ok) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.fieldErrors };
      submitted.current = values;
      return savePaymentAction(input);
    },
    onSaved: () => {
      setBaseline(submitted.current);
      logo.saved();
      signature.saved();
    },
  });

  const set = (field: keyof Values) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    edited(field);
  };

  const upi = values.upiId.trim();
  const upiReady = upi !== "" && upiProblem(upi) === null;
  const receiptName = displayReceiptName({ receiptName: values.receiptName, name: settings.name }) || "Your name";
  const uploading = logo.busy || signature.busy;

  return (
    <SettingsSection
      id="payment"
      title="Payment"
      description="What tenants see on payment links, QR codes and printed receipts."
      status={uploading && status.kind === "saving" ? { kind: "saving", slow: false, note: UPLOAD_MESSAGES.uploading } : status}
      dirty={dirty}
      savedMessage="Saved. New payment links and receipts use these details."
      saveLabel="Save payment details"
      onSave={save}
    >
      <div className="flex flex-col gap-2">
        <TextField
          label="Your UPI ID"
          className="max-w-md"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={values.upiId}
          onChange={set("upiId")}
          validate={upiProblem}
          error={fieldErrors.upiId}
          helper="This appears on payment links and QR codes sent to tenants."
        />
        <div>
          {upiReady ? (
            <Button variant="secondary" onClick={() => setTesting(true)}>
              Test with ₹1
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled
              disabledReason={upi === "" ? "Type your UPI ID first." : "Fix the UPI ID above first."}
            >
              Test with ₹1
            </Button>
          )}
        </div>
        {upi === "" && (
          <p className="text-small text-warning">
            Without a UPI ID, payment links are switched off and receipts print without a payment code.
          </p>
        )}
      </div>

      <TextField
        label="Name to show on receipts"
        className="max-w-md"
        value={values.receiptName}
        onChange={set("receiptName")}
        validate={receiptNameProblem}
        error={fieldErrors.receiptName}
        placeholder={settings.name}
        helper={`Printed on receipts and settlement statements. Leave empty to use your name, ${settings.name}.`}
      />

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageSlotField slot={logo} error={fieldErrors.logo} />
          <ImageSlotField slot={signature} error={fieldErrors.signature} />
        </div>
        <ReceiptPreview receiptName={receiptName} logoUrl={logo.previewUrl} signatureUrl={signature.previewUrl} />
      </div>

      {testing && upiReady && (
        <UpiTestSheet open upiId={upi} payeeName={receiptName} onClose={() => setTesting(false)} />
      )}
    </SettingsSection>
  );
}
