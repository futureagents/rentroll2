"use client";
// Uploads request photos straight to the private bucket with one-time signed URLs from the
// server, then records them (../actions.ts). S-04 owns compression; until that lane lands the
// files go up as picked (bucket limit 10 MB).
// PROMOTE: photo upload — belongs to S-04 (A2 Photo uploader's `onAdd` driver).
import { useCallback, useState } from "react";

import type { UploaderPhoto } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

import { createPhotoUploads, recordPhotos } from "../actions";

export function usePhotoUpload() {
  const [photos, setPhotos] = useState<(UploaderPhoto & { file: File })[]>([]);

  /** Adds picked files as thumbnails and returns them, so a caller can upload them at once. */
  const add = useCallback((files: File[], alt = "Photo of the problem") => {
    const entries = files.map((file) => ({ id: crypto.randomUUID(), src: URL.createObjectURL(file), alt, file }));
    setPhotos((current) => [...current, ...entries]);
    return entries;
  }, []);

  const remove = useCallback((id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }, []);

  const clear = useCallback(() => setPhotos([]), []);

  /** Uploads every picked photo to the request. Returns an error message, or null. */
  const upload = useCallback(
    async (requestId: string, kind: "before" | "after", picked = photos): Promise<string | null> => {
      if (picked.length === 0) return null;
      const prepared = await createPhotoUploads(
        requestId,
        picked.map((photo) => ({ type: photo.file.type, size: photo.file.size })),
      );
      if (!prepared.ok) return prepared.error;
      const storage = createSupabaseBrowserClient().storage.from("documents");
      for (const [index, slot] of prepared.uploads.entries()) {
        setPhotos((current) => current.map((p) => (p.id === picked[index].id ? { ...p, progress: 50 } : p)));
        const { error } = await storage.uploadToSignedUrl(slot.path, slot.token, picked[index].file, {
          contentType: picked[index].file.type,
        });
        if (error) return "Could not save. Your changes are still here — try again.";
      }
      const recorded = await recordPhotos(
        requestId,
        kind,
        prepared.uploads.map((slot, index) => ({ documentId: slot.documentId, fileName: picked[index].file.name })),
      );
      if (!recorded.ok) return recorded.error;
      return null;
    },
    [photos],
  );

  return { photos, add, remove, clear, upload };
}
