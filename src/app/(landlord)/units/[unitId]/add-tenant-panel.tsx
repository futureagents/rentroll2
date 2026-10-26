"use client";
// L09-FRM-ADDTENANT † (D-39), opened by L09-BTN-ADDTENANT, a panel over L-09.
//
// Step 1 · Tenant and agreement: name, phone, email (optional), move-in date, agreement start
// (defaults to move-in) and end, rent (defaults to the unit's rent), rent due day (defaults to the
// 1st, D-09), deposit paid (defaults to the unit's deposit), deposit received on, ID proof.
// Step 2 · Condition photos (S-04, up to 10). Skippable, with the consequence stated plainly
// (proposed decision amending D-39): with no photos the save button itself says so.
//
// Saving creates the tenancy and its tenant link, the first agreement, the first rent row (D-24)
// and the documents, all on the server (src/server/landlord/units/mutations.ts).
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { SidePanel } from "@/components/shell/detail-panel-host";
import { Button, DateField, Dropdown, MoneyField, PhoneField, PhotoUploader, TextField, useToast } from "@/components/ui";

import { addTenancyAction } from "../actions";
import { useUploads } from "../_components/use-uploads";
import { DOCUMENT_MIME, MAX_LANDLORD_PHOTOS, moveInPhotoAlt } from "../_lib/files";
import { hasErrors, NO_PHOTOS_CONSEQUENCE, validateTenancy, type FieldErrors, type TenancyField, type TenancyFields } from "../_lib/forms";
import type { UnitView } from "./view";

const DUE_DAYS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

const STEP_ONE_FIELDS: TenancyField[] = [
  "name",
  "phone",
  "email",
  "movedInOn",
  "startsOn",
  "endsOn",
  "rent",
  "rentDueDay",
  "depositPaid",
  "depositReceivedOn",
];

function initialFields(view: UnitView): TenancyFields {
  return {
    name: "",
    phone: "",
    email: "",
    movedInOn: view.today,
    startsOn: view.today,
    endsOn: "",
    rent: view.askingRent,
    rentDueDay: 1,
    depositPaid: view.askingDeposit,
    depositReceivedOn: "",
  };
}

export function AddTenantPanel({ view, open, onClose }: { view: UnitView; open: boolean; onClose: () => void }) {
  // Remount on each open so a cancelled form starts clean.
  return open ? <AddTenantForm view={view} onClose={onClose} /> : null;
}

function AddTenantForm({ view, onClose }: { view: UnitView; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [fields, setFields] = useState<TenancyFields>(() => initialFields(view));
  const [startTouched, setStartTouched] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<TenancyField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const altFor = useCallback((i: number) => moveInPhotoAlt(view.label, fields.name.trim() || "the new tenant", i), [fields.name, view.label]);
  const photos = useUploads("move_in_photo", MAX_LANDLORD_PHOTOS, altFor);
  const idProof = useUploads("id_proof", 1, () => "ID proof");

  const set = <K extends keyof TenancyFields>(key: K, value: TenancyFields[K]) => {
    setDirty(true);
    setFields((current) => {
      const next = { ...current, [key]: value };
      // Agreement start follows the move-in date until the landlord sets it (D-39 default).
      if (key === "movedInOn" && !startTouched) next.startsOn = value as TenancyFields["startsOn"];
      return next;
    });
  };

  const next = () => {
    const all = validateTenancy(fields);
    const stepErrors = Object.fromEntries(STEP_ONE_FIELDS.filter((f) => all[f]).map((f) => [f, all[f]])) as FieldErrors<TenancyField>;
    setErrors(stepErrors);
    if (hasErrors(stepErrors)) {
      setFormError("Check the highlighted fields.");
      return;
    }
    if (idProof.uploading || idProof.failed) {
      setFormError(idProof.failed ? "The ID proof did not upload. Remove it and add it again." : "Wait for the ID proof to finish uploading.");
      return;
    }
    setFormError(null);
    setStep(2);
  };

  // S-04: "Submitting while an upload is in progress waits for it, with the button showing
  // 'Uploading photo…'".
  const save = () => {
    setFormError(null);
    startTransition(async () => {
      setWaiting(photos.uploading);
      const settled = await photos.whenSettled();
      setWaiting(false);
      if (settled.failed) {
        setFormError("Some photos did not upload. Remove them, or add them again.");
        return;
      }
      const result = await addTenancyAction(view.id, {
        ...fields,
        photos: settled.finished.map((p) => ({ ...p, type: "move_in_photo" as const })),
        idProof: idProof.finished[0] ? { ...idProof.finished[0], type: "id_proof" as const } : null,
      });
      if (result.ok) {
        toast.show({ message: `${fields.name.trim()} added. Share their tenant link from the Overview.` });
        onClose();
        router.refresh();
        return;
      }
      if (result.fieldErrors && hasErrors(result.fieldErrors)) {
        setErrors(result.fieldErrors);
        setStep(1);
      }
      setFormError(result.error);
    });
  };

  const photoCount = photos.items.length;

  const footer =
    step === 1 ? (
      <>
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={next}>Next: condition photos</Button>
      </>
    ) : (
      <>
        {pending || waiting ? (
          <Button variant="quiet" disabled disabledReason="Saving the tenant">
            Back
          </Button>
        ) : (
          <Button variant="quiet" onClick={() => setStep(1)}>
            Back
          </Button>
        )}
        {waiting ? (
          <Button loading>Uploading photo…</Button>
        ) : (
          <Button loading={pending} onClick={save}>
            {photoCount === 0 ? "Save without photos" : "Save tenant"}
          </Button>
        )}
      </>
    );

  return (
    <SidePanel
      open
      onClose={onClose}
      title="Add tenant"
      subtitle={`${view.label} · Step ${step} of 2: ${step === 1 ? "tenant and agreement" : "condition photos"}`}
      footer={footer}
      dirty={dirty || photoCount > 0}
    >
      <div className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-sm bg-danger/12 px-3 py-2 text-small text-danger">
            {formError}
          </p>
        )}
        <div hidden={step !== 1} className="flex flex-col gap-4">
          <TextField label="Name" required value={fields.name} onChange={(v) => set("name", v)} error={errors.name} autoComplete="off" maxLength={120} />
          <PhoneField label="Phone" required value={fields.phone} onChange={(v) => set("phone", v)} error={errors.phone} />
          <TextField label="Email" type="email" value={fields.email} onChange={(v) => set("email", v)} error={errors.email} helper="Optional." autoComplete="off" />
          <DateField label="Move-in date" required value={fields.movedInOn} onChange={(v) => set("movedInOn", v)} error={errors.movedInOn} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField
              label="Agreement starts"
              required
              value={fields.startsOn}
              onChange={(v) => {
                setStartTouched(true);
                set("startsOn", v);
              }}
              error={errors.startsOn}
            />
            <DateField label="Agreement ends" required value={fields.endsOn} onChange={(v) => set("endsOn", v)} error={errors.endsOn} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField label="Rent" required value={fields.rent} onChange={(v) => set("rent", v)} error={errors.rent} helper="Monthly, from the agreement." />
            <Dropdown
              label="Rent due day"
              required
              value={fields.rentDueDay === null ? "" : String(fields.rentDueDay)}
              onChange={(v) => set("rentDueDay", v === "" ? null : Number(v))}
              options={DUE_DAYS}
              error={errors.rentDueDay}
              helper="Day of the month. 29–31 fall on the last day of shorter months."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField label="Deposit paid" required value={fields.depositPaid} onChange={(v) => set("depositPaid", v)} error={errors.depositPaid} />
            <DateField
              label="Deposit received on"
              value={fields.depositReceivedOn}
              onChange={(v) => set("depositReceivedOn", v)}
              error={errors.depositReceivedOn}
              required={(fields.depositPaid ?? 0) > 0}
            />
          </div>
          <IdProofField uploads={idProof} />
        </div>

        <div hidden={step !== 2} className="flex flex-col gap-4">
          <p className="text-body">
            Photograph each room as it is handed over: walls, floors, doors, fittings, appliances and any damage already there.
          </p>
          <PhotoUploader
            label="Condition photos"
            photos={photos.items}
            max={MAX_LANDLORD_PHOTOS}
            onAdd={(files) => {
              setDirty(true);
              photos.add(files);
            }}
            onRemove={photos.remove}
            onEnlarge={(id) => {
              const src = photos.items.find((p) => p.id === id)?.src;
              if (src) window.open(src, "_blank", "noopener");
            }}
            capture="environment"
          />
          {photoCount === 0 && (
            <p className="rounded-sm bg-warning/12 px-3 py-2 text-small text-ink">
              You can skip this step. {NO_PHOTOS_CONSEQUENCE} Photos can be added later from the unit&apos;s Photos tab.
            </p>
          )}
        </div>
      </div>
    </SidePanel>
  );
}

function IdProofField({ uploads }: { uploads: ReturnType<typeof useUploads> }) {
  const item = uploads.items[0];
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label uppercase text-muted">ID proof</span>
      {item ? (
        <div className="flex items-center gap-2 rounded-sm border border-line bg-canvas px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-small text-body">{item.fileName}</span>
          <span className={`text-small ${item.error ? "text-danger" : "text-muted"}`} role={item.error ? "alert" : undefined}>
            {item.error ?? (item.documentId ? "Uploaded" : `Uploading ${item.progress ?? 0}%`)}
          </span>
          <Button variant="icon" icon="close" label="Remove ID proof" onClick={() => uploads.remove(item.id)} />
        </div>
      ) : (
        <label className="inline-flex h-10 w-fit cursor-pointer items-center rounded-sm border border-primary bg-surface px-4 text-(length:--text-body) font-medium text-primary hover:bg-primary-soft focus-within:ring-2 focus-within:ring-primary">
          Choose file
          <input
            type="file"
            accept={DOCUMENT_MIME.join(",")}
            className="sr-only"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length) uploads.add(files);
            }}
          />
        </label>
      )}
      <p className="text-small text-muted">Optional. PDF or photo, up to 10 MB.</p>
    </div>
  );
}
