"use client";
// L06-BTN-NEW: "Opens the same form as T-01, with an added unit selector and a 'reported by'
// field defaulting to 'phone call'". D-29: a landlord screen, so up to 10 photos.
// PROMOTE: request form — the T-01 form fields (category, description, photos, urgency, name,
// phone). Tenant code may not be imported here (scripts/check-boundaries.mjs), so a shared
// version would live in src/components and be used by both T-01 and this panel.
import { useState } from "react";

import { SidePanel } from "@/components/shell/detail-panel-host";
import { Button, Dropdown, PhoneField, PhotoUploader, SegmentedChoice, TextArea, TextField } from "@/components/ui";

import { logRequest } from "../actions";
import { DESCRIPTION_SHORT } from "../_lib/lifecycle";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  LANDLORD_REPORTED_VIA,
  REPORTED_VIA_LABEL,
  type Category,
  type LandlordReportedVia,
  type UnitOption,
  type Urgency,
} from "../_lib/model";
import { usePhotoUpload } from "./use-photo-upload";

/** T01-SEG-URGENCY: "Low · Normal · Urgent. Defaults to Normal." */
const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

export function NewRequestPanel({
  open,
  units,
  onClose,
  onLogged,
}: {
  open: boolean;
  units: UnitOption[];
  onClose: () => void;
  /** `photosFailed`: the request was created but a photo did not upload. */
  onLogged: (requestId: string, requestNumber: string, photosFailed: boolean) => void;
}) {
  const [unitId, setUnitId] = useState("");
  const [reportedVia, setReportedVia] = useState<LandlordReportedVia>("phone");
  const [category, setCategory] = useState<Category | "">("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const photos = usePhotoUpload();

  const dirty = unitId !== "" || category !== "" || description !== "" || name !== "" || phone !== "" || photos.photos.length > 0;

  const reset = () => {
    setUnitId("");
    setReportedVia("phone");
    setCategory("");
    setDescription("");
    setUrgency("normal");
    setName("");
    setPhone("");
    setError(null);
    setSubmitted(false);
    photos.clear();
  };

  const descriptionError =
    submitted && description.trim().length < 10 ? (description.trim() ? DESCRIPTION_SHORT : "This is needed to continue.") : null;

  const submit = async () => {
    setSubmitted(true);
    if (!unitId || !category || description.trim().length < 10) return;
    setSaving(true);
    setError(null);
    const result = await logRequest({
      unitId,
      reportedVia,
      reporterName: name,
      reporterPhone: phone,
      category,
      urgency,
      description,
    });
    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }
    // The request exists now; a photo that fails to upload can be added again on L-07.
    const photoError = await photos.upload(result.requestId, "before");
    setSaving(false);
    reset();
    onLogged(result.requestId, result.requestNumber, photoError !== null);
  };

  return (
    <SidePanel
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Log a request"
      subtitle="For problems reported by phone or in person"
      dirty={dirty}
      footer={
        <>
          {error ? (
            <p role="alert" className="mr-auto self-center text-small text-danger">
              {error}
            </p>
          ) : null}
          <Button onClick={submit} loading={saving}>
            Log request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Dropdown
          label="Unit"
          value={unitId}
          onChange={setUnitId}
          options={units.map((u) => ({ value: u.id, label: u.label }))}
          required
          error={submitted && !unitId ? "This is needed to continue." : null}
        />
        <Dropdown
          label="Reported by"
          value={reportedVia}
          onChange={(value) => setReportedVia(value as LandlordReportedVia)}
          options={LANDLORD_REPORTED_VIA.map((via) => ({ value: via, label: REPORTED_VIA_LABEL[via] }))}
        />
        <Dropdown
          label="What is the problem?"
          value={category}
          onChange={(value) => setCategory(value as Category)}
          options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          required
          error={submitted && !category ? "This is needed to continue." : null}
        />
        <TextArea
          label="Describe it"
          value={description}
          onChange={setDescription}
          placeholder="Geyser is leaking from the bottom since yesterday."
          required
          error={descriptionError}
        />
        <PhotoUploader
          label="Add a photo"
          photos={photos.photos}
          max={10}
          onAdd={photos.add}
          onRemove={photos.remove}
        />
        <SegmentedChoice label="How urgent?" options={URGENCY_OPTIONS} value={urgency} onChange={setUrgency} />
        <TextField label="Name" value={name} onChange={setName} helper="Who reported it, if not the tenant on record" />
        <PhoneField label="Phone" value={phone} onChange={setPhone} />
      </div>
    </SidePanel>
  );
}
