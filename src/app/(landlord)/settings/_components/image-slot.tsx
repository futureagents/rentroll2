"use client";
// L15-UPL-LOGO and L15-UPL-SIGNATURE † (D-15, D-56): one optional image each, uploaded through
// S-04 as soon as it is picked and attached only when Payment is saved, replacing the previous.
// The section owns one slot per image; this file holds the slot's state and its field.
import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { PhotoUploader, UPLOAD_MESSAGES, signedUrlTransport, useUploadQueue } from "@/components/upload";
import type { ImageChange, ImageKind } from "@/lib/settings";

import { signImageUploadAction } from "../actions";

export interface ImageSlot {
  kind: ImageKind;
  /** What saving Payment would do to this image right now. */
  change: ImageChange;
  /** The image the receipt preview shows: the picked one, else the saved one unless removed. */
  previewUrl: string | null;
  busy: boolean;
  /** Waits for a running upload; the change to send, or the error to show on the field. */
  settle: () => Promise<{ ok: true; change: ImageChange } | { ok: false; error: string }>;
  /** After Payment saved: the saved image is now the page's, the uploader is free again. */
  saved: () => void;
  field: { queueState: ReturnType<typeof useUploadQueue>; savedUrl: string | null; removing: boolean; setRemoving: (v: boolean) => void };
}

export function useImageSlot(kind: ImageKind, savedUrl: string | null, alt: string): ImageSlot {
  const [removing, setRemoving] = useState(false);
  const transport = useMemo(() => signedUrlTransport((file) => signImageUploadAction(kind, file)), [kind]);
  const queueState = useUploadQueue({ max: 1, transport, altFor: () => alt });
  const { queue, photos, busy } = queueState;
  const picked = photos[0] ?? null;

  const change: ImageChange = picked
    ? { action: "replace", documentId: picked.ref ?? "", fileName: kind }
    : removing
      ? { action: "remove" }
      : { action: "keep" };

  return {
    kind,
    change,
    previewUrl: picked?.previewUrl ?? (removing ? null : savedUrl),
    busy,
    // S-04: "Submitting while an upload is in progress waits for it."
    settle: async () => {
      const photo = (await queue.whenSettled())[0];
      if (!photo) return { ok: true, change: removing ? { action: "remove" } : { action: "keep" } };
      if (photo.status !== "done" || !photo.ref) return { ok: false, error: photo.error ?? UPLOAD_MESSAGES.failed };
      return { ok: true, change: { action: "replace", documentId: photo.ref, fileName: kind } };
    },
    saved: () => {
      setRemoving(false);
      // The page has re-rendered with a signed URL for the saved image (revalidatePath), so the
      // local copy can go.
      queue.dispose();
    },
    field: { queueState, savedUrl, removing, setRemoving },
  };
}

const WORDS: Record<ImageKind, { label: string; noun: string; helper: string; removed: string }> = {
  logo: {
    label: "Logo (optional)",
    noun: "logo",
    helper: "A square or wide logo on a white background prints best.",
    removed: "The logo comes off your receipts when you save.",
  },
  signature: {
    label: "Signature (optional)",
    noun: "signature",
    helper:
      "Sign in dark ink on plain white paper and photograph it, or use a PNG or JPEG. It prints above the signature line on receipts you print. Tenants' copies keep a blank line.",
    removed: "Receipts go back to a blank signature line when you save.",
  },
};

export function ImageSlotField({ slot, error }: { slot: ImageSlot; error?: string }) {
  const { queueState, savedUrl, removing, setRemoving } = slot.field;
  const picked = queueState.photos[0] ?? null;
  const words = WORDS[slot.kind];
  const hasSaved = Boolean(savedUrl) && !removing;

  return (
    <div className="flex flex-col gap-2">
      <PhotoUploader
        queue={queueState.queue}
        label={words.label}
        helper={hasSaved ? `Pick a new image to replace your ${words.noun}. ${words.helper}` : words.helper}
      />
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      {hasSaved && !picked && (
        <div>
          <Button variant="quiet" icon="trash" onClick={() => setRemoving(true)}>
            Remove {words.noun}
          </Button>
        </div>
      )}
      {removing && !picked && (
        <p className="text-small text-muted">
          {words.removed}{" "}
          <button type="button" className="text-primary underline underline-offset-2" onClick={() => setRemoving(false)}>
            Keep it
          </button>
        </p>
      )}
      {queueState.failed.length > 0 && (
        <p className="text-small text-muted">Retry the {words.noun}, or remove it to save the rest.</p>
      )}
    </div>
  );
}
