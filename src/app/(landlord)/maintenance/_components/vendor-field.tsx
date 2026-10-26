"use client";
// L07-FLD-VENDOR · D-16: "a combobox: typing filters the landlord's vendors; 'Add <name>' creates
// one and asks for the phone."
// PROMOTE: combobox — an A2 "Form fields" row (text field with filtered suggestions).
import { useId, useState } from "react";

import { Button, Icon, PhoneField } from "@/components/ui";
import { controlClasses } from "@/components/ui/field";
import { formatPhone } from "@/lib/format";

import { addVendor } from "../actions";
import type { VendorOption } from "../_lib/model";

export function VendorField({
  vendors,
  value,
  onChange,
  onVendorAdded,
}: {
  vendors: VendorOption[];
  value: string | null;
  onChange: (vendorId: string | null) => void;
  onVendorAdded: (vendor: VendorOption) => void;
}) {
  const id = useId();
  const selected = vendors.find((v) => v.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needle = query.trim().toLowerCase();
  const matches = vendors.filter((v) => v.name.toLowerCase().includes(needle));
  const exact = vendors.some((v) => v.name.toLowerCase() === needle);

  const save = async () => {
    if (!adding) return;
    setSaving(true);
    setError(null);
    const result = await addVendor(adding, phone);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onVendorAdded(result.vendor);
    onChange(result.vendor.id);
    setAdding(null);
    setPhone("");
    setQuery("");
  };

  if (selected) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-label uppercase text-muted">Vendor</span>
        <div className="flex min-h-10 items-center justify-between gap-2 rounded-sm border border-line bg-surface px-3">
          <span className="min-w-0 truncate text-ink">
            {selected.name} · <span className="text-muted">{formatPhone(selected.phone)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {/* D-16: L-07 gains a call icon beside the vendor (C-5 "calling a vendor"). */}
            <a
              href={`tel:${selected.phone}`}
              aria-label={`Call ${selected.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-body hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="call" />
            </a>
            <Button variant="icon" icon="close" label="Remove vendor" onClick={() => onChange(null)} />
          </span>
        </div>
      </div>
    );
  }

  if (adding !== null) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-line p-3">
        <p className="text-h2 text-ink">Add {adding}</p>
        <PhoneField label="Vendor phone" value={phone} onChange={setPhone} required error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setAdding(null)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Add vendor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-label uppercase text-muted">
        Vendor
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Type a vendor's name"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={controlClasses(false)}
      />
      {open && (matches.length > 0 || (needle && !exact)) ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-line bg-surface py-1 shadow-2"
        >
          {matches.map((vendor) => (
            <li key={vendor.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(vendor.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none"
              >
                <span className="text-ink">{vendor.name}</span>
                <span className="text-small text-muted">{formatPhone(vendor.phone)}</span>
              </button>
            </li>
          ))}
          {needle && !exact ? (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setAdding(query.trim());
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-primary hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none"
              >
                <Icon name="plus" /> Add {query.trim()}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
