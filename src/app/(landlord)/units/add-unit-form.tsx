"use client";
// L08-BTN-ADDUNIT inline form (D-39): property, unit number, type, rent, deposit. The property
// dropdown ends with "Add a property…", which reveals name and address (the L-02 fields).
// Unit numbers are unique within a property; the same number in another building is fine.
import { useId, useMemo, useState, useTransition } from "react";

import { Button, Dropdown, MoneyField, TextField } from "@/components/ui";

import { createUnitAction } from "./actions";
import {
  hasErrors,
  UNIT_TYPE_SUGGESTIONS,
  validateNewUnit,
  type FieldErrors,
  type UnitField,
} from "./_lib/forms";

const NEW_PROPERTY = "__new";

export interface AddUnitFormProps {
  properties: { id: string; name: string }[];
  units: { id: string; propertyId: string; unitNumber: string }[];
  /** Open on "Add a property…" (L-03 "No data at all" → L-08, D-39). */
  startWithNewProperty?: boolean;
  onDone: (unitId: string) => void;
  onCancel: () => void;
}

export function AddUnitForm({ properties, units, startWithNewProperty, onDone, onCancel }: AddUnitFormProps) {
  const listId = useId();
  const [propertyChoice, setPropertyChoice] = useState(
    startWithNewProperty || properties.length === 0 ? NEW_PROPERTY : properties.length === 1 ? properties[0].id : "",
  );
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [type, setType] = useState("");
  const [rent, setRent] = useState<number | null>(null);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [errors, setErrors] = useState<FieldErrors<UnitField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const propertyNames = useMemo(() => new Map(properties.map((p) => [p.id, p.name])), [properties]);
  const isNew = propertyChoice === NEW_PROPERTY;

  const submit = () => {
    const input = {
      propertyId: isNew ? null : propertyChoice,
      propertyName,
      propertyAddress,
      unitNumber,
      type,
      rent,
      deposit,
    };
    const local = validateNewUnit(input, units, propertyNames);
    setErrors(local);
    setFormError(null);
    if (hasErrors(local)) return;
    startTransition(async () => {
      const result = await createUnitAction(input);
      if (result.ok) {
        onDone(result.unitId);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      if (!result.fieldErrors) setFormError(result.error);
    });
  };

  return (
    <form
      aria-labelledby={`${listId}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6"
    >
      <h2 id={`${listId}-title`} className="text-h2 text-ink">
        Add unit
      </h2>
      {formError && (
        <p role="alert" className="rounded-sm bg-danger/12 px-3 py-2 text-small text-danger">
          {formError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Dropdown
          label="Property"
          required
          value={propertyChoice}
          onChange={(value) => setPropertyChoice(value)}
          placeholder="Choose a property"
          options={[...properties.map((p) => ({ value: p.id, label: p.name })), { value: NEW_PROPERTY, label: "Add a property…" }]}
          error={errors.propertyId}
        />
        {isNew && (
          <>
            <TextField label="Property name" required value={propertyName} onChange={setPropertyName} error={errors.propertyName} maxLength={120} />
            <TextField
              label="Property address"
              required
              value={propertyAddress}
              onChange={setPropertyAddress}
              error={errors.propertyAddress}
              helper="Used for directions to the property."
              maxLength={300}
            />
          </>
        )}
        <TextField
          label="Unit number"
          required
          value={unitNumber}
          onChange={setUnitNumber}
          error={errors.unitNumber}
          helper="Unique within the property, for example 4C or G1."
          maxLength={20}
        />
        <TextField label="Type" value={type} onChange={setType} error={errors.type} list={`${listId}-types`} helper="For example 1BHK or PG bed." maxLength={40} />
        <datalist id={`${listId}-types`}>
          {UNIT_TYPE_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <MoneyField label="Rent" required value={rent} onChange={setRent} error={errors.rent} helper="Monthly asking rent." />
        <MoneyField
          label="Deposit"
          value={deposit}
          onChange={setDeposit}
          error={errors.deposit}
          helper="Asking deposit. Each tenant's actual deposit is entered when they move in."
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {pending ? (
          <Button variant="quiet" disabled disabledReason="Saving the unit">
            Cancel
          </Button>
        ) : (
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={pending}>
          Save unit
        </Button>
      </div>
    </form>
  );
}
