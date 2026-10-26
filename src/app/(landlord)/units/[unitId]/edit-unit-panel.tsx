"use client";
// L09-BTN-EDITUNIT † (D-39): edits unit number, type, rent and deposit. Delete sits here as a
// Danger action behind a confirm dialog, allowed only for a unit that has never had a tenant
// (D-39) or a repair (its costs would go with it).
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { SidePanel } from "@/components/shell/detail-panel-host";
import { Button, ConfirmDialog, MoneyField, TextField, useToast } from "@/components/ui";

import { deleteUnitAction, updateUnitAction } from "../actions";
import { hasErrors, UNIT_TYPE_SUGGESTIONS, validateUnitEdit, type FieldErrors, type UnitFields } from "../_lib/forms";
import type { UnitView } from "./view";

export function EditUnitPanel({ view, open, onClose }: { view: UnitView; open: boolean; onClose: () => void }) {
  return open ? <EditUnitForm view={view} onClose={onClose} /> : null;
}

function EditUnitForm({ view, onClose }: { view: UnitView; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const listId = useId();
  const [fields, setFields] = useState<UnitFields>({
    unitNumber: view.unitNumber,
    type: view.type ?? "",
    rent: view.askingRent,
    deposit: view.askingDeposit,
  });
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<keyof UnitFields>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  const set = <K extends keyof UnitFields>(key: K, value: UnitFields[K]) => {
    setDirty(true);
    setFields((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    const local = validateUnitEdit(
      { id: view.id, propertyId: view.propertyId, unitNumber: view.unitNumber },
      fields,
      view.siblings,
      view.propertyName,
    );
    setErrors(local);
    setFormError(null);
    if (hasErrors(local)) return;
    startTransition(async () => {
      const result = await updateUnitAction(view.id, fields);
      if (result.ok) {
        toast.show({ message: "Unit saved." });
        onClose();
        router.refresh();
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
    });
  };

  const remove = () =>
    startDelete(async () => {
      const result = await deleteUnitAction(view.id);
      if (result.ok) {
        router.push("/units");
        return;
      }
      setConfirmDelete(false);
      setFormError(result.error);
    });

  return (
    <SidePanel
      open
      onClose={onClose}
      title="Edit unit"
      subtitle={view.label}
      dirty={dirty}
      footer={
        <>
          {view.canDelete ? (
            <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)} className="mr-auto">
              Delete unit
            </Button>
          ) : (
            <Button variant="danger" icon="trash" disabled disabledReason="A unit with tenants or repairs on record cannot be deleted" className="mr-auto">
              Delete unit
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={pending} onClick={save}>
            Save unit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-sm bg-danger/12 px-3 py-2 text-small text-danger">
            {formError}
          </p>
        )}
        <TextField
          label="Unit number"
          required
          value={fields.unitNumber}
          onChange={(v) => set("unitNumber", v)}
          error={errors.unitNumber}
          helper={`Unique within ${view.propertyName}.`}
          maxLength={20}
        />
        <TextField label="Type" value={fields.type} onChange={(v) => set("type", v)} error={errors.type} list={`${listId}-types`} maxLength={40} />
        <datalist id={`${listId}-types`}>
          {UNIT_TYPE_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <MoneyField
          label="Asking rent"
          required
          value={fields.rent}
          onChange={(v) => set("rent", v)}
          error={errors.rent}
          helper="The default for the next tenant. A current agreement's rent does not change."
        />
        <MoneyField
          label="Asking deposit"
          value={fields.deposit}
          onChange={(v) => set("deposit", v)}
          error={errors.deposit}
          helper="The default for the next tenant."
        />
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this unit?"
        consequence={`${view.label} and its door QR code will be removed. Printed stickers for it stop working.`}
        actionLabel="Delete unit"
        destructive
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </SidePanel>
  );
}
