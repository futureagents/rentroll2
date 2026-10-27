"use client";
// S-04 · Photo uploader: S04-ZONE (tap to choose or take a photo; drag and drop on desktop),
// S04-THUMB (the local file at once, a progress ring over it, tap to enlarge, X to remove) and
// S04-ERR (the error on the failing thumbnail, never a popup, a summary or a toast), with Retry on
// the thumbnail. It renders an UploadQueue the screen owns (use-upload-queue.ts); it holds no
// upload state of its own, so scrolling, the keyboard or a remount never stops an upload.
//
// PROMOTE: S-04 uploader with per-photo status and Retry on the thumbnail → A2 "Photo uploader"
// row (src/components/ui/photo-uploader.tsx). The A2 placeholder has no Retry and no preparing
// state; promoting this replaces it and the lane-local upload hooks in L-07, L-09 and T-01.
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { Button, Icon, Modal } from "@/components/ui";

import { PHOTO_ACCEPT } from "./limits";
import type { QueuedPhoto, UploadQueue } from "./queue";
import { useQueueState } from "./use-upload-queue";

export interface PhotoUploaderProps {
  queue: UploadQueue;
  label: string;
  /** Replaces the count line under the photos. */
  helper?: string;
  /**
   * Set to open the camera with no gallery choice. Left unset, a phone offers "take a photo" and
   * the gallery together (S04-ZONE "Tap to choose or take a photo").
   */
  capture?: "environment" | "user";
  disabled?: boolean;
  className?: string;
}

/** Moves focus to the first failed photo's Retry (or Remove), so a waiting submit can point at it. */
export function focusFirstFailedPhoto(queue: UploadQueue): void {
  const failed = queue.getSnapshot().find((p) => p.status === "failed");
  if (failed) document.getElementById(problemButtonId(failed.id, queue))?.focus();
}

const queueKeys = new WeakMap<UploadQueue, string>();
let queueCounter = 0;
function keyOf(queue: UploadQueue): string {
  let key = queueKeys.get(queue);
  if (!key) queueKeys.set(queue, (key = `upl${++queueCounter}`));
  return key;
}
const problemButtonId = (photoId: string, queue: UploadQueue) => `${keyOf(queue)}-${photoId}-fix`;

export function PhotoUploader({ queue, label, helper, capture, disabled, className = "" }: PhotoUploaderProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const { photos } = useQueueState(queue);
  const max = queue.max;
  const full = photos.length >= max;
  const announcement = useAnnouncement(photos);
  const shown = photos.find((p) => p.id === enlarged && p.previewUrl);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // picking the same file again still fires change
    if (files.length) queue.add(files);
  };
  const drop = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    setDragging(false);
    // Every dropped file is taken, so a wrong type shows S04-ERR on its own thumbnail.
    if (!disabled) queue.add(Array.from(event.dataTransfer.files));
  };
  const plural = max === 1 ? "photo" : "photos";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span id={`${id}-label`} className="text-label uppercase text-muted">
        {label}
      </span>
      <ul className="flex flex-wrap gap-2" aria-labelledby={`${id}-label`}>
        {photos.map((photo) => (
          <Thumbnail
            key={photo.id}
            photo={photo}
            fixId={problemButtonId(photo.id, queue)}
            onRemove={() => queue.remove(photo.id)}
            onRetry={() => queue.retry(photo.id)}
            onEnlarge={() => setEnlarged(photo.id)}
            onPreviewError={() => queue.previewFailed(photo.id)}
          />
        ))}
        {!full && (
          <li
            onDragOver={(event) => {
              event.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={
              "flex h-34 w-26 rounded-sm border border-dashed transition-colors " +
              (dragging ? "border-primary bg-primary-soft" : "border-line bg-surface")
            }
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              aria-describedby={`${id}-helper`}
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-sm px-2 text-center text-small text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:text-muted"
            >
              <Icon name="photo" size={24} />
              Add photo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={PHOTO_ACCEPT}
              capture={capture}
              multiple={max - photos.length > 1}
              onChange={pick}
              disabled={disabled}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
          </li>
        )}
      </ul>
      <p id={`${id}-helper`} className="text-small text-muted">
        {helper ?? (full ? `Maximum ${max} ${plural}.` : `Up to ${max} ${plural}. ${photos.length} of ${max} added.`)}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Modal open={Boolean(shown)} labelledBy={`${id}-enlarged`} onDismiss={() => setEnlarged(null)}>
        {shown && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
              <h2 id={`${id}-enlarged`} className="text-h2 text-ink">
                {shown.alt}
              </h2>
              <Button variant="icon" icon="close" label="Close" size={48} onClick={() => setEnlarged(null)} />
            </div>
            <div className="flex flex-1 items-center justify-center bg-canvas p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not a static asset */}
              <img src={shown.previewUrl!} alt={shown.alt} className="max-h-[75dvh] max-w-full object-contain" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Thumbnail({
  photo,
  fixId,
  onRemove,
  onRetry,
  onEnlarge,
  onPreviewError,
}: {
  photo: QueuedPhoto;
  fixId: string;
  onRemove: () => void;
  onRetry: () => void;
  onEnlarge: () => void;
  onPreviewError: () => void;
}) {
  const working = photo.status === "preparing" || photo.status === "uploading";
  const failed = photo.status === "failed";
  return (
    <li className="relative h-34 w-26 overflow-hidden rounded-sm border border-line bg-canvas">
      {photo.previewUrl ? (
        <button
          type="button"
          onClick={onEnlarge}
          aria-label={`Enlarge ${photo.alt}`}
          className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not a static asset */}
          <img src={photo.previewUrl} alt={photo.alt} onError={onPreviewError} className="h-full w-full object-cover" />
        </button>
      ) : (
        // Only a HEIC outside Safari lands here: the browser cannot draw it until it is converted.
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted" role="img" aria-label={photo.alt}>
          <Icon name="photo" size={24} />
        </div>
      )}

      {working && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={photo.status === "uploading" ? photo.progress : undefined}
          aria-valuetext={photo.status === "preparing" ? "Preparing" : `${photo.progress}% uploaded`}
          aria-label={`${photo.alt}: uploading`}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/40 text-surface"
        >
          <ProgressRing value={photo.status === "uploading" ? photo.progress : 0} />
          <span className="text-label">{photo.status === "preparing" ? "Preparing" : `${photo.progress}%`}</span>
        </div>
      )}

      {photo.status === "done" && (
        <span className="pointer-events-none absolute bottom-1 left-1 flex h-6 items-center gap-1 rounded-sm bg-surface px-1 text-label text-success shadow-1">
          <Icon name="check" size={12} />
          Uploaded
        </span>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col bg-ink/60">
          <p role="alert" className="flex flex-1 items-center px-2 pt-10 text-label text-surface">
            <span>
              <span className="sr-only">{photo.alt}: </span>
              {photo.error}
            </span>
          </p>
          {photo.retryable ? (
            <button
              id={fixId}
              type="button"
              onClick={onRetry}
              aria-label={`Retry ${photo.alt}`}
              className="h-12 w-full shrink-0 bg-surface text-(length:--text-body) font-medium text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              Retry
            </button>
          ) : (
            <button
              id={fixId}
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${photo.alt}`}
              className="h-12 w-full shrink-0 bg-surface text-(length:--text-body) font-medium text-danger hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* X to remove: a 48px target (A4 tenant minimum) around a small visible button. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${photo.alt}`}
        className="group absolute right-0 top-0 flex h-12 w-12 items-start justify-end p-1 focus-visible:outline-none"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-surface text-ink shadow-1 group-hover:bg-canvas group-focus-visible:ring-2 group-focus-visible:ring-primary">
          <Icon name="close" size={12} />
        </span>
      </button>
    </li>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="-rotate-90">
      <circle cx="20" cy="20" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-surface/40" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-surface transition-[stroke-dashoffset]"
      />
    </svg>
  );
}

/** E5: a screen-reader line when a photo finishes. Failures announce through their role="alert". */
function useAnnouncement(photos: readonly QueuedPhoto[]): string {
  const previous = useRef(new Map<string, QueuedPhoto["status"]>());
  const [message, setMessage] = useState("");
  useEffect(() => {
    const done = photos.filter((p) => p.status === "done" && previous.current.get(p.id) !== "done");
    previous.current = new Map(photos.map((p) => [p.id, p.status]));
    if (done.length) setMessage(done.map((p) => `${p.alt} uploaded.`).join(" "));
  }, [photos]);
  return message;
}
