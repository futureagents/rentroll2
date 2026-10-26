"use client";
// Adds move-in condition photos to an existing tenancy (L09-TAB-PHOTOS †, D-39 "Later photos …
// are added … with the same uploader"). A2 PhotoUploader, landlord limit 10 per tenancy (S-04).
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button, PhotoUploader, useToast } from "@/components/ui";

import { attachDocumentsAction } from "../actions";
import { MAX_LANDLORD_PHOTOS, moveInPhotoAlt } from "../_lib/files";
import { useUploads } from "./use-uploads";

export function MoveInPhotoAdder({
  tenancyId,
  unitId,
  unitLabel,
  tenantName,
  existing,
}: {
  tenancyId: string;
  unitId: string;
  unitLabel: string;
  tenantName: string;
  existing: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const room = Math.max(0, MAX_LANDLORD_PHOTOS - existing);
  const altFor = useCallback((i: number) => moveInPhotoAlt(unitLabel, tenantName, existing + i), [existing, tenantName, unitLabel]);
  const uploads = useUploads("move_in_photo", room, altFor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (room === 0) return <p className="text-small text-muted">This tenancy has the maximum of {MAX_LANDLORD_PHOTOS} photos.</p>;

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await attachDocumentsAction({ tenancyId, unitId, type: "move_in_photo", files: uploads.finished });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    uploads.reset();
    toast.show({ message: result.count === 1 ? "Photo added." : `${result.count} photos added.` });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      <PhotoUploader
        label="Add move-in photos"
        photos={uploads.items}
        max={room}
        onAdd={uploads.add}
        onRemove={uploads.remove}
        onEnlarge={(id) => {
          const src = uploads.items.find((p) => p.id === id)?.src;
          if (src) window.open(src, "_blank", "noopener");
        }}
        capture="environment"
      />
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      {uploads.items.length > 0 &&
        (uploads.uploading ? (
          <Button variant="secondary" loading className="self-start">
            Uploading photo…
          </Button>
        ) : uploads.failed ? (
          <Button variant="secondary" disabled disabledReason="Remove the photos that did not upload, then save" className="self-start">
            Save photos
          </Button>
        ) : (
          <Button variant="secondary" loading={saving} onClick={save} className="self-start">
            Save photos
          </Button>
        ))}
    </div>
  );
}
