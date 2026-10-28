"use client";
// L15-SEC-PAYMENT †: L15-FLD-UPI (with "Test with ₹1" †), L15-FLD-RECEIPTNAME and L15-UPL-LOGO.
// The logo goes up through S-04 (one photo, D-15) as soon as it is picked; it is attached to the
// landlord only when this section is saved, replacing the previous one. The receipt preview
// follows what is typed and picked, so the landlord sees the printed result before saving.
import { useEffect, useMemo, useState } from "react";

import { Button, TextField } from "@/components/ui";
import { PhotoUploader, UPLOAD_MESSAGES, signedUrlTransport, useUploadQueue } from "@/components/upload";
import {
  CHECK_FIELDS,
  displayReceiptName,
  parsePayment,
  receiptNameProblem,
  upiProblem,
  type LandlordSettings,
  type LogoChange,
  type PaymentField,
} from "@/lib/settings";

import { savePaymentAction, signLogoUploadAction } from "./actions";
import { ReceiptPreview } from "./_components/receipt-preview";
import { SettingsSection, useSectionSave } from "./_components/section";
import { UpiTestSheet } from "./_components/upi-test-sheet";

interface Values {
  upiId: string;
  receiptName: string;
}

export function PaymentSection({
  settings,
  logoUrl,
  onDirtyChange,
}: {
  settings: LandlordSettings;
  /** Short-lived URL of the saved logo; refreshed by the page after every save. */
  logoUrl: string | null;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [baseline, setBaseline] = useState<Values>(() => ({
    upiId: settings.upiId ?? "",
    receiptName: settings.receiptName ?? "",
  }));
  const [values, setValues] = useState(baseline);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [testing, setTesting] = useState(false);
  const transport = useMemo(() => signedUrlTransport(signLogoUploadAction), []);
  const { queue, photos, busy, failed } = useUploadQueue({ max: 1, transport, altFor: () => "Your logo" });
  const picked = photos[0] ?? null;

  const logoChange: LogoChange =
    picked
      ? { action: "replace", documentId: picked.ref ?? "", fileName: "logo" }
      : removeLogo
        ? { action: "remove" }
        : { action: "keep" };
  const dirty =
    values.upiId.trim() !== baseline.upiId.trim() ||
    values.receiptName.trim() !== baseline.receiptName.trim() ||
    logoChange.action !== "keep";
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const { status, fieldErrors, save, edited } = useSectionSave<PaymentField>({
    save: async () => {
      // S-04: "Submitting while an upload is in progress waits for it."
      const settled = await queue.whenSettled();
      const photo = settled[0];
      if (photo && photo.status !== "done") {
        return { ok: false, error: CHECK_FIELDS, fieldErrors: { logo: photo.error ?? UPLOAD_MESSAGES.failed } };
      }
      const logo: LogoChange = photo?.ref ? { action: "replace", documentId: photo.ref, fileName: "logo" } : logoChange;
      const input = { ...values, logo };
      const parsed = parsePayment(input);
      if (!parsed.ok) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.fieldErrors };
      return savePaymentAction(input);
    },
    onSaved: () => {
      setBaseline(values);
      setRemoveLogo(false);
      // The page has re-rendered with a signed URL for the saved logo (revalidatePath), so the
      // local copy can go and the uploader is free for the next replacement.
      queue.dispose();
    },
  });

  const set = (field: keyof Values) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    edited(field);
  };

  const upi = values.upiId.trim();
  const upiReady = upi !== "" && upiProblem(upi) === null;
  const receiptName = displayReceiptName({ receiptName: values.receiptName, name: settings.name }) || "Your name";
  const previewLogo = picked?.previewUrl ?? (removeLogo ? null : logoUrl);
  const hasSavedLogo = Boolean(logoUrl) && !removeLogo;

  return (
    <SettingsSection
      id="payment"
      title="Payment"
      description="What tenants see on payment links, QR codes and printed receipts."
      status={busy && status.kind === "saving" ? { kind: "saving", slow: false, note: UPLOAD_MESSAGES.uploading } : status}
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

      <div className="flex flex-col gap-3">
        <PhotoUploader
          queue={queue}
          label="Logo (optional)"
          helper={
            hasSavedLogo
              ? "Pick a new image to replace your logo. A square or wide logo on a white background prints best."
              : "A square or wide logo on a white background prints best."
          }
        />
        {fieldErrors.logo && (
          <p role="alert" className="text-small text-danger">
            {fieldErrors.logo}
          </p>
        )}
        {hasSavedLogo && !picked && (
          <div>
            <Button variant="quiet" icon="trash" onClick={() => setRemoveLogo(true)}>
              Remove logo
            </Button>
          </div>
        )}
        {removeLogo && !picked && (
          <p className="text-small text-muted">
            The logo comes off your receipts when you save.{" "}
            <button type="button" className="text-primary underline underline-offset-2" onClick={() => setRemoveLogo(false)}>
              Keep it
            </button>
          </p>
        )}
        {failed.length > 0 && <p className="text-small text-muted">Retry the logo, or remove it to save the rest.</p>}
        <ReceiptPreview receiptName={receiptName} logoUrl={previewLogo} />
      </div>

      {testing && upiReady && (
        <UpiTestSheet open upiId={upi} payeeName={receiptName} onClose={() => setTesting(false)} />
      )}
    </SettingsSection>
  );
}
