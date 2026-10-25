"use client";
// A2 · Photo uploader — placeholder for S-04. Renders the drop zone (S04-ZONE), thumbnails
// with a progress ring (S04-THUMB, E3 photo upload) and inline errors on the thumbnail
// (S04-ERR). It does not compress or upload: the S-04 lane supplies `onAdd` and drives the
// `photos` prop. Max 3 photos on tenant screens, 10 on landlord screens (S-04 rules).
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Icon } from "./icons";

export interface UploaderPhoto {
  id: string;
  /** Local object URL or stored URL. */
  src: string;
  /** Meaningful alternative text, never the file name (E5). */
  alt: string;
  /** 0–100 while the upload runs; omit when done. */
  progress?: number;
  /** S04-ERR wording: "That file is too large" / "That file type is not supported". */
  error?: string;
}

export interface PhotoUploaderProps {
  label: string;
  photos: UploaderPhoto[];
  /** 3 on tenant screens, 10 on landlord screens. */
  max: 3 | 10 | number;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onEnlarge?: (id: string) => void;
  helper?: string;
  disabled?: boolean;
  /** Pass "environment" on tenant screens so the camera opens directly on a phone. */
  capture?: "environment" | "user";
  className?: string;
}

export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/heic,image/webp";

export function PhotoUploader({
  label,
  photos,
  max,
  onAdd,
  onRemove,
  onEnlarge,
  helper,
  disabled,
  capture,
  className = "",
}: PhotoUploaderProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const full = photos.length >= max;
  const blocked = disabled || full;

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) onAdd(files.slice(0, max - photos.length));
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (blocked) return;
    const files = Array.from(event.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length) onAdd(files.slice(0, max - photos.length));
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span id={`${id}-label`} className="text-label uppercase text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`}>
        {photos.map((photo) => (
          <Thumbnail key={photo.id} photo={photo} onRemove={onRemove} onEnlarge={onEnlarge} />
        ))}
        {!full && (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!blocked) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={
              "flex h-24 w-24 items-center justify-center rounded-sm border border-dashed transition-colors " +
              (dragging ? "border-primary bg-primary-soft" : "border-line bg-surface")
            }
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              aria-describedby={`${id}-helper`}
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-sm text-small text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:text-muted"
            >
              <Icon name="photo" size={20} />
              Add photo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              capture={capture}
              multiple={max - photos.length > 1}
              onChange={pick}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
      <p id={`${id}-helper`} className="text-small text-muted">
        {helper ?? (full ? `Maximum ${max} photos.` : `Up to ${max} photos. ${photos.length} of ${max} added.`)}
      </p>
    </div>
  );
}

function Thumbnail({
  photo,
  onRemove,
  onEnlarge,
}: {
  photo: UploaderPhoto;
  onRemove: (id: string) => void;
  onEnlarge?: (id: string) => void;
}) {
  const uploading = photo.progress !== undefined && photo.progress < 100 && !photo.error;
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-sm border border-line bg-canvas">
      <button
        type="button"
        onClick={() => onEnlarge?.(photo.id)}
        aria-label={`Enlarge: ${photo.alt}`}
        className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs, not a static asset */}
        <img src={photo.src} alt={photo.alt} className="h-full w-full object-cover" />
      </button>
      {uploading && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={photo.progress}
          aria-label={`Uploading ${photo.alt}`}
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40"
        >
          <ProgressRing value={photo.progress ?? 0} />
        </div>
      )}
      {photo.error && (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-0 bg-danger px-1 py-1 text-center text-label text-surface"
        >
          {photo.error}
        </p>
      )}
      <button
        type="button"
        onClick={() => onRemove(photo.id)}
        aria-label={`Remove ${photo.alt}`}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-sm bg-surface text-ink shadow-1 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" className="-rotate-90">
      <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-surface/40" />
      <circle
        cx="18"
        cy="18"
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
