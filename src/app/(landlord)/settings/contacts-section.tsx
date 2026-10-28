"use client";
// L15-SEC-CONTACTS †: L15-FLD-NAME †, L15-FLD-PHONE † (D-20) and L15-FLD-CAEMAIL. While the phone
// is empty, tenant pages hide "Call the landlord" and P-03 drops its fallback line (D-20), so the
// section says so in one line.
import { useEffect, useRef, useState } from "react";

import { PhoneField, TextField } from "@/components/ui";
import { formatPhone } from "@/lib/format";
import {
  CHECK_FIELDS,
  emailProblem,
  nameProblem,
  parseContacts,
  phoneDigits,
  type ContactsField,
  type ContactsInput,
  type LandlordSettings,
} from "@/lib/settings";

import { saveContactsAction } from "./actions";
import { SettingsSection, useSectionSave } from "./_components/section";

function initialValues(settings: LandlordSettings): ContactsInput {
  return { name: settings.name, phone: phoneDigits(settings.phone), accountantEmail: settings.accountantEmail ?? "" };
}

const same = (a: ContactsInput, b: ContactsInput) =>
  a.name.trim() === b.name.trim() && a.phone === b.phone && a.accountantEmail.trim() === b.accountantEmail.trim();

export function ContactsSection({
  settings,
  onDirtyChange,
}: {
  settings: LandlordSettings;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [baseline, setBaseline] = useState(() => initialValues(settings));
  const [values, setValues] = useState(baseline);
  /** What the last save sent: edits typed while it was in flight stay unsaved. */
  const submitted = useRef(baseline);
  const dirty = !same(values, baseline);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const { status, fieldErrors, save, edited } = useSectionSave<ContactsField>({
    save: async () => {
      const parsed = parseContacts(values);
      if (!parsed.ok) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.fieldErrors };
      submitted.current = values;
      return saveContactsAction(values);
    },
    onSaved: () => setBaseline(submitted.current),
  });

  const set = (field: ContactsField) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    edited(field);
  };

  const savedPhone = baseline.phone ? formatPhone(`+91${baseline.phone}`) : null;

  return (
    <SettingsSection
      id="contacts"
      title="Contacts"
      description="How tenants reach you, and where your accountant's exports go."
      status={status}
      dirty={dirty}
      savedMessage={
        savedPhone
          ? `Saved. Tenant pages and door cards show ${savedPhone}.`
          : "Saved."
      }
      saveLabel="Save contacts"
      onSave={save}
    >
      <TextField
        label="Your name"
        className="max-w-md"
        autoComplete="name"
        value={values.name}
        onChange={set("name")}
        validate={nameProblem}
        error={fieldErrors.name}
        helper="Shown to tenants on their unit page."
      />
      <div className="flex max-w-md flex-col gap-1">
        <PhoneField
          label="Your phone"
          autoComplete="tel-national"
          value={values.phone}
          onChange={set("phone")}
          error={fieldErrors.phone}
          helper="Tenants can call or WhatsApp you from their unit link, and it prints on door QR cards."
        />
        {baseline.phone === "" && (
          <p className="text-small text-warning">
            Add your phone so tenants can call you — until then their pages show no call button.
          </p>
        )}
      </div>
      <TextField
        label="Accountant's email"
        type="email"
        className="max-w-md"
        autoComplete="off"
        value={values.accountantEmail}
        onChange={set("accountantEmail")}
        validate={emailProblem}
        error={fieldErrors.accountantEmail}
        helper="Email to accountant on Documents & exports opens an email addressed here. Nothing is sent until you send it."
      />
    </SettingsSection>
  );
}
