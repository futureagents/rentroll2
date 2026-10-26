"use client";
// Upload state for the A2 PhotoUploader and the document picker on L09-FRM-ADDTENANT,
// L09-TAB-PHOTOS † and L11-SEC-DOCS †. Each file shows at once from the local copy (E3), is
// compressed on the device (S-04: "A 6MB phone photo should leave as roughly 400KB"), then goes
// straight to storage on a one-time URL the server signed for the landlord's own folder, with a
// progress ring. Nothing is attached to a tenancy until the screen's save action runs.
//
// PROMOTE: S-04 compression and upload — the S-04 lane owns on-device compression and the upload
// pipeline for the A2 PhotoUploader; this is the minimum local version so move-in photos can be
// captured now. It should become the S-04 hook and these local copies be deleted.
import { useCallback, useEffect, useRef, useState } from "react";

import type { UploaderPhoto } from "@/components/ui";
import { publicEnv } from "@/lib/env";

import { startUploadAction } from "../actions";
import { NOT_SUPPORTED, TOO_LARGE, uploadProblem, type TenancyDocumentType } from "../_lib/files";

export interface UploadItem extends UploaderPhoto {
  /** Set once the file is stored; the save action sends it. */
  documentId?: string;
  fileName: string;
}

const COMPRESS_OVER_BYTES = 600 * 1024;
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;

/** Re-encodes a large photo as a JPEG no wider or taller than 1600px. Returns the original when that does not help. */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size <= COMPRESS_OVER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // e.g. HEIC where the browser cannot decode it: send as taken
  }
}

function put(url: string, body: Blob, onProgress: (percent: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", body.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", publicEnv().supabaseAnonKey);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(body);
  });
}

/**
 * Compresses (photos), asks the server for a one-time URL in the landlord's folder, and uploads.
 * Errors use the S04-ERR wording where it applies.
 */
export async function uploadFile(
  file: File,
  type: TenancyDocumentType,
  onProgress: (percent: number) => void,
): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  const body = await compress(file);
  const mime = body.type || file.type;
  const problem = uploadProblem(type, mime, body.size);
  if (problem) return { ok: false, error: problem };
  const started = await startUploadAction({ type, mime, size: body.size });
  if (!started.ok) {
    return { ok: false, error: started.error === TOO_LARGE || started.error === NOT_SUPPORTED ? started.error : "Could not upload" };
  }
  const stored = await put(started.upload.signedUrl, body, onProgress);
  return stored ? { ok: true, documentId: started.upload.documentId } : { ok: false, error: "Could not upload" };
}

export interface SettledUploads {
  finished: { documentId: string; fileName: string; alt: string | null }[];
  failed: boolean;
}

export function useUploads(type: TenancyDocumentType, max: number, altFor: (index: number) => string) {
  const [items, setItems] = useState<UploadItem[]>([]);
  // `latest` mirrors `items` synchronously: two quick adds never exceed `max`, and a save that
  // waited for uploads (S-04) reads the finished list without waiting for a re-render.
  const latest = useRef<UploadItem[]>([]);
  const pending = useRef(new Set<Promise<void>>());
  const counter = useRef(0);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = useCallback((change: (list: UploadItem[]) => UploadItem[]) => {
    latest.current = change(latest.current);
    setItems(latest.current);
  }, []);

  const patch = useCallback(
    (id: string, change: Partial<UploadItem>) => update((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item))),
    [update],
  );

  const upload = useCallback(
    (id: string, file: File) => {
      const job = uploadFile(file, type, (progress) => patch(id, { progress })).then((result) =>
        patch(id, result.ok ? { documentId: result.documentId, progress: undefined } : { error: result.error, progress: undefined }),
      );
      pending.current.add(job);
      void job.finally(() => pending.current.delete(job));
    },
    [patch, type],
  );

  const add = useCallback(
    (files: File[]) => {
      const already = latest.current.length;
      const accepted = files.slice(0, Math.max(0, max - already));
      const fresh = accepted.map((file, i): UploadItem => {
        counter.current += 1;
        const src = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
        if (src) urls.current.push(src);
        return { id: `local-${counter.current}`, src, alt: altFor(already + i), fileName: file.name, progress: 0 };
      });
      update((list) => [...list, ...fresh]);
      fresh.forEach((item, i) => upload(item.id, accepted[i]));
    },
    [altFor, max, update, upload],
  );

  const remove = useCallback((id: string) => update((list) => list.filter((item) => item.id !== id)), [update]);
  const reset = useCallback(() => update(() => []), [update]);

  const summarise = useCallback(
    (list: UploadItem[]): SettledUploads => ({
      finished: list
        .filter((item): item is UploadItem & { documentId: string } => Boolean(item.documentId))
        .map((item) => ({ documentId: item.documentId, fileName: item.fileName, alt: type === "move_in_photo" ? item.alt : null })),
      failed: list.some((item) => Boolean(item.error)),
    }),
    [type],
  );

  /** S-04: a save pressed while photos upload waits for them, then reads what finished. */
  const whenSettled = useCallback(async (): Promise<SettledUploads> => {
    while (pending.current.size > 0) await Promise.all([...pending.current]);
    return summarise(latest.current);
  }, [summarise]);

  const uploading = items.some((item) => !item.error && !item.documentId);
  const { finished, failed } = summarise(items);

  return { items, add, remove, reset, uploading, failed, finished, whenSettled };
}
