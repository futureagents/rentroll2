"use client";
// T-01 · Report a problem — the form. Components T01-SEL-CATEGORY, T01-FLD-DESC, T01-UPL-PHOTO,
// T01-SEG-URGENCY, T01-FLD-NAME, T01-FLD-PHONE, T01-BTN-SUBMIT.
//
// Every field is controlled and the photos are held as compressed blobs, so a refused or failed
// submit leaves everything the tenant typed and attached in place (T-01 "Submission failed").
// The action is called directly, not through <form action>, which would reset the form.
// Validation failure scrolls to the first invalid field and shows the error under it; never a
// summary, never a popup. Offline (D-31): the form stays usable and Submit is sent when the
// connection returns while the page is open; nothing is queued beyond the page.
// Errors are the form's own: each A2 field gets `error ?? ""`, because an undefined error lets the
// field fall back to its blur-time message, which stays stale after the value is corrected.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";

import { Button, Dropdown, PhoneField, PhotoUploader, SegmentedChoice, TextArea, TextField, type UploaderPhoto } from "@/components/ui";
import { MAX_TENANT_PHOTOS } from "@/lib/tenant/photos";
import {
  CATEGORY_OPTIONS,
  DEFAULT_URGENCY,
  DESCRIPTION_MAX,
  firstInvalidField,
  NAME_MAX,
  TENANT_CATEGORY_LABEL,
  TENANT_MESSAGES,
  URGENCY_OPTIONS,
  validateReport,
  type Category,
  type FieldErrors,
  type ReportField,
  type SubmitResult,
  type Urgency,
} from "@/lib/tenant/report";

import { InvalidLink } from "../_components/invalid-link";
import { submitReport } from "./actions";
import { compressPhoto, type Compressed } from "./compress";
import { keepSummary } from "./summary";

export interface ReportFormProps {
  token: string;
  /** Tenant link only; a door token starts blank (D-02). */
  prefill: { name: string; phone: string } | null;
  /** Invisible bot check stamp, signed by the server at render. */
  stamp: string;
}

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
const isOnline = () => navigator.onLine;
const onlineOnServer = () => true;

let photoCounter = 0;

export function ReportForm({ token, prefill, stamp: initialStamp }: ReportFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<Urgency>(DEFAULT_URGENCY);
  const [name, setName] = useState(prefill?.name ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [photos, setPhotos] = useState<UploaderPhoto[]>([]);
  const photosRef = useRef<UploaderPhoto[]>([]);
  // Compression jobs by photo id. Read by the submit directly, so it never depends on a re-render.
  const compressed = useRef(new Map<string, Promise<Compressed>>());

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [stamp, setStamp] = useState(initialStamp);
  const [waitingForConnection, setWaitingForConnection] = useState(false);
  const [linkGone, setLinkGone] = useState(false);
  const [pending, startTransition] = useTransition();
  const online = useSyncExternalStore(subscribeOnline, isOnline, onlineOnServer);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  // Release thumbnail URLs when the form goes away.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.src)), []);

  const clearError = (field: ReportField) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const focusField = (field: ReportField | null) => {
    if (!field) return;
    const wrapper = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (!wrapper) return;
    wrapper.scrollIntoView({ block: "center", behavior: "smooth" });
    wrapper.querySelector<HTMLElement>("select, textarea, input:not([type=file]), button")?.focus({ preventScroll: true });
  };

  const addPhotos = (files: File[]) => {
    clearError("photos");
    const room = MAX_TENANT_PHOTOS - photosRef.current.length;
    const added: UploaderPhoto[] = files.slice(0, room).map((file) => {
      const id = `photo-${++photoCounter}`;
      const job = compressPhoto(file);
      compressed.current.set(id, job);
      // S04-ERR: the message shows on the thumbnail.
      void job.then((result) => {
        if (!result.ok) setPhotos((current) => current.map((p) => (p.id === id ? { ...p, error: result.message } : p)));
      });
      // S04-THUMB: the thumbnail shows at once from the local file.
      return { id, src: URL.createObjectURL(file), alt: "" };
    });
    setPhotos((current) => [...current, ...added]);
  };

  const removePhoto = (id: string) => {
    clearError("photos");
    setPhotos((current) => {
      const gone = current.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.src);
      return current.filter((p) => p.id !== id);
    });
    compressed.current.delete(id);
  };

  const submit = () => {
    setFormMessage(null);
    const checked = validateReport({ category, description, urgency, name, phone });
    const photoError = photosRef.current.find((p) => p.error)?.error;
    const found: FieldErrors = { ...(checked.ok ? {} : checked.errors), ...(photoError ? { photos: photoError } : {}) };
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusField(firstInvalidField(found));
      return;
    }
    setErrors({});
    if (!navigator.onLine) {
      setWaitingForConnection(true);
      return;
    }
    setWaitingForConnection(false);

    const ids = photosRef.current.map((p) => p.id);
    startTransition(async () => {
      // S-04: "Submitting while an upload is in progress waits for it".
      const results = await Promise.all(ids.map((id) => compressed.current.get(id)));
      const refused = results.find((r): r is Extract<Compressed, { ok: false }> => r?.ok === false);
      if (refused) {
        setErrors({ photos: refused.message });
        focusField("photos");
        return;
      }
      const ready = results.flatMap((r) => (r?.ok ? [r.blob] : []));
      const form = new FormData();
      form.set("category", category);
      form.set("description", description);
      form.set("urgency", urgency);
      form.set("name", name);
      form.set("phone", phone);
      form.set("stamp", stamp);
      form.set("website", honeypotRef.current?.value ?? "");
      ready.forEach((blob, i) => form.append("photo", blob, `photo-${i + 1}`));

      let result: SubmitResult;
      try {
        result = await submitReport(token, form);
      } catch {
        result = { status: "retry", message: TENANT_MESSAGES.submitFailed };
      }

      if (result.status === "reported") {
        keepSummary(token, result.requestNumber, {
          category: TENANT_CATEGORY_LABEL[category as Category],
          description: description.trim(),
          photoCount: ready.length,
        });
        router.push(`/u/${token}/reported/${result.requestNumber}`);
      } else if (result.status === "fields") {
        setErrors(result.errors);
        focusField(firstInvalidField(result.errors));
      } else if (result.status === "retry") {
        if (result.stamp) setStamp(result.stamp);
        setFormMessage(result.message);
      } else {
        // The tenancy ended while the form was open: E1-10 now, and the page re-resolves so
        // nothing else (header, call button) stays on screen.
        setLinkGone(true);
        router.refresh();
      }
    });
  };

  // D-31: a Submit made while offline is sent when the connection returns, if the page is open.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (!waitingForConnection) return;
    const send = () => submitRef.current();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [waitingForConnection]);

  if (linkGone) return <InvalidLink />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!pending) submit();
  };

  // E5: meaningful alternative text, never the file name.
  const uploaderPhotos = photos.map((p, i) => ({ ...p, alt: `Photo ${i + 1} of the problem` }));

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {!online && (
        <p role="status" className="rounded-sm border border-warning bg-warning/12 p-3 text-small text-ink">
          {TENANT_MESSAGES.offline}
        </p>
      )}

      <div data-field="category">
        <Dropdown
          label="What is the problem?"
          value={category}
          onChange={(value) => {
            setCategory(value);
            clearError("category");
          }}
          options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          error={errors.category ?? ""}
          required
          disabled={pending}
          className="[&_select]:h-12"
        />
      </div>

      <div data-field="description">
        <TextArea
          label="Describe it"
          value={description}
          onChange={(value) => {
            setDescription(value);
            clearError("description");
          }}
          placeholder="Geyser is leaking from the bottom since yesterday."
          error={errors.description ?? ""}
          maxLength={DESCRIPTION_MAX}
          required
          disabled={pending}
        />
      </div>

      <div data-field="photos" className="flex flex-col gap-1">
        <PhotoUploader
          label="Add a photo"
          photos={uploaderPhotos}
          max={MAX_TENANT_PHOTOS}
          onAdd={addPhotos}
          onRemove={removePhoto}
          capture="environment"
          disabled={pending}
          helper={photos.length === 0 ? "A photo helps your landlord see the problem. Up to 3." : undefined}
        />
        {errors.photos && (
          <p role="alert" className="text-small text-danger">
            {errors.photos}
          </p>
        )}
      </div>

      <div data-field="urgency">
        <SegmentedChoice
          label="How urgent?"
          options={URGENCY_OPTIONS}
          value={urgency}
          onChange={setUrgency}
          size={48}
          error={errors.urgency ?? ""}
          disabled={pending}
        />
      </div>

      <div data-field="name">
        <TextField
          label="Your name"
          value={name}
          onChange={(value) => {
            setName(value);
            clearError("name");
          }}
          autoComplete="name"
          maxLength={NAME_MAX}
          error={errors.name ?? ""}
          disabled={pending}
          className="[&_input]:h-12"
        />
      </div>

      <div data-field="phone">
        <PhoneField
          label="Your phone"
          value={phone}
          onChange={(value) => {
            setPhone(value);
            clearError("phone");
          }}
          error={errors.phone ?? ""}
          disabled={pending}
          className="[&_input]:h-12"
        />
      </div>

      {/* Invisible bot check (T-01 Rules): people never see or reach this field. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Website
          <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-canvas p-4 sm:static sm:mx-0 sm:border-0 sm:p-0">
        {(formMessage || waitingForConnection) && (
          <p role="alert" className="text-small text-danger">
            {formMessage ?? TENANT_MESSAGES.offline}
          </p>
        )}
        <Button type="submit" variant="primary" size={48} block loading={pending}>
          {pending && photos.length > 0 ? "Uploading photo…" : "Submit"}
        </Button>
      </div>
    </form>
  );
}
