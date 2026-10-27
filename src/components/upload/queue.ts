// S-04 · the upload queue. A plain store, not component state: the screen creates it once
// (`useUploadQueue`) and the uploader only renders it. Nothing here watches visibility, focus or
// mount state, so an upload carries on while the page scrolls, the keyboard opens and closes, or
// the uploader is unmounted and mounted again. Only `remove` and `dispose` stop one.
//
// Per photo: a local thumbnail at once → preparation on the device (prepare.ts), one photo at a
// time to spare a small phone's memory → upload, two at a time → done, or failed with the error
// kept on the photo. A failed photo keeps its original file and its compressed copy, so Retry
// never asks the user to pick it again.
import { UPLOAD_CONCURRENCY, UPLOAD_MESSAGES } from "./limits";
import { preparePhoto } from "./prepare";
import type { UploadTransport } from "./transport";

export type PhotoStatus = "preparing" | "uploading" | "done" | "failed";

export interface QueuedPhoto {
  id: string;
  /**
   * Local object URL: the picked file at once, then the compressed copy. Null while a photo the
   * browser cannot show as picked (HEIC outside Safari) is being converted.
   */
  previewUrl: string | null;
  /** E5: meaningful alternative text, never the file name. */
  alt: string;
  status: PhotoStatus;
  /** Upload progress 0–100. */
  progress: number;
  /** S04-ERR wording or UPLOAD_MESSAGES.failed; null unless failed. */
  error: string | null;
  /** False when Retry cannot help (too large, not a photo): the photo can only be removed. */
  retryable: boolean;
  /** What the transport returned; the screen's save action receives these. */
  ref: string | null;
  originalBytes: number;
  /** Size that leaves the device, once compressed. */
  uploadBytes: number | null;
  width: number | null;
  height: number | null;
}

export interface UploadQueueOptions {
  /** 3 on tenant screens, 10 on landlord screens (S-04); 1 for the L15-UPL-LOGO logo (D-15). */
  max: number;
  transport: UploadTransport;
  /** Alternative text for the photo at `index` (0-based). Recomputed when one is removed. */
  altFor?: (index: number) => string;
}

interface Job {
  file: File;
  blob: Blob | null;
  controller: AbortController | null;
  urls: string[];
}

const defaultAlt = (index: number) => `Photo ${index + 1}`;

export class UploadQueue {
  readonly max: number;
  private readonly transport: UploadTransport;
  private readonly altFor: (index: number) => string;
  private photos: readonly QueuedPhoto[] = [];
  private readonly jobs = new Map<string, Job>();
  private readonly listeners = new Set<() => void>();
  private waiters: Array<(photos: readonly QueuedPhoto[]) => void> = [];
  private toPrepare: string[] = [];
  private toUpload: string[] = [];
  private preparing = false;
  private uploading = 0;
  private counter = 0;
  private listening = false;

  constructor({ max, transport, altFor = defaultAlt }: UploadQueueOptions) {
    this.max = max;
    this.transport = transport;
    this.altFor = altFor;
  }

  // useSyncExternalStore contract: stable functions, an immutable snapshot replaced on change.
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly QueuedPhoto[] => this.photos;

  /** True while any photo is being prepared or uploaded. */
  get busy(): boolean {
    return this.photos.some((p) => p.status === "preparing" || p.status === "uploading");
  }

  /** Refs of finished photos, in the order shown. */
  get refs(): string[] {
    return this.photos.flatMap((p) => (p.status === "done" && p.ref ? [p.ref] : []));
  }

  /** Adds photos up to the limit and starts on them. Returns how many were taken. */
  add(files: File[]): number {
    const accepted = files.slice(0, Math.max(0, this.max - this.photos.length));
    if (accepted.length === 0) return 0;
    this.listenForConnection();
    const added = accepted.map((file): QueuedPhoto => {
      const id = `photo-${++this.counter}`;
      const url = URL.createObjectURL(file);
      this.jobs.set(id, { file, blob: null, controller: null, urls: [url] });
      this.toPrepare.push(id);
      return {
        id,
        previewUrl: url,
        alt: "",
        status: "preparing",
        progress: 0,
        error: null,
        retryable: false,
        ref: null,
        originalBytes: file.size,
        uploadBytes: null,
        width: null,
        height: null,
      };
    });
    this.commit([...this.photos, ...added]);
    void this.pumpPrepare();
    return accepted.length;
  }

  /** Removes a photo, stopping its upload if one is running. */
  remove(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.controller?.abort();
    job.urls.forEach((url) => URL.revokeObjectURL(url));
    this.jobs.delete(id);
    this.toPrepare = this.toPrepare.filter((x) => x !== id);
    this.toUpload = this.toUpload.filter((x) => x !== id);
    this.commit(this.photos.filter((p) => p.id !== id));
  }

  /** Tries a failed photo again from where it failed, with the file it already holds. */
  retry(id: string): void {
    const job = this.jobs.get(id);
    const photo = this.photos.find((p) => p.id === id);
    if (!job || photo?.status !== "failed" || !photo.retryable) return;
    if (job.blob) {
      this.toUpload.push(id);
      this.patch(id, { status: "uploading", progress: 0, error: null });
      this.pumpUpload();
    } else {
      this.toPrepare.push(id);
      this.patch(id, { status: "preparing", progress: 0, error: null });
      void this.pumpPrepare();
    }
  }

  /** The browser could not show the picked file (HEIC outside Safari): wait for the converted copy. */
  previewFailed(id: string): void {
    const photo = this.photos.find((p) => p.id === id);
    const job = this.jobs.get(id);
    if (photo && job && photo.previewUrl === job.urls[0] && !job.blob) this.patch(id, { previewUrl: null });
  }

  /** S-04: "Submitting while an upload is in progress waits for it." Resolves when nothing is running. */
  whenSettled(): Promise<readonly QueuedPhoto[]> {
    if (!this.busy) return Promise.resolve(this.photos);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Stops everything and frees the local copies. Call after the screen has saved, or to start over. */
  dispose(): void {
    for (const id of [...this.jobs.keys()]) this.remove(id);
    if (this.listening && typeof window !== "undefined") window.removeEventListener("online", this.onOnline);
    this.listening = false;
  }

  // ---------------------------------------------------------------------------------------------

  private commit(next: readonly QueuedPhoto[]): void {
    this.photos = next.map((p, i) => {
      const alt = this.altFor(i);
      return p.alt === alt ? p : { ...p, alt };
    });
    this.listeners.forEach((listener) => listener());
    if (!this.busy && this.waiters.length) {
      const waiters = this.waiters;
      this.waiters = [];
      waiters.forEach((resolve) => resolve(this.photos));
    }
  }

  private patch(id: string, change: Partial<QueuedPhoto>): void {
    this.commit(this.photos.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }

  private async pumpPrepare(): Promise<void> {
    if (this.preparing) return;
    this.preparing = true;
    try {
      for (let id = this.toPrepare.shift(); id; id = this.toPrepare.shift()) {
        const job = this.jobs.get(id);
        if (!job) continue;
        const result = await preparePhoto(job.file).catch(() => ({
          ok: false as const,
          error: UPLOAD_MESSAGES.notSupported,
          retryable: false,
        }));
        if (this.jobs.get(id) !== job) continue; // removed while it was being prepared
        if (!result.ok) {
          this.patch(id, { status: "failed", error: result.error, retryable: result.retryable });
          continue;
        }
        job.blob = result.blob;
        // Show the compressed copy from here on and let the browser drop the full-size original.
        const [original] = job.urls;
        const url = URL.createObjectURL(result.blob);
        job.urls = [url];
        URL.revokeObjectURL(original);
        this.toUpload.push(id);
        this.patch(id, {
          previewUrl: url,
          status: "uploading",
          progress: 0,
          uploadBytes: result.blob.size,
          width: result.width,
          height: result.height,
        });
        this.pumpUpload();
      }
    } finally {
      this.preparing = false;
    }
  }

  private pumpUpload(): void {
    while (this.uploading < UPLOAD_CONCURRENCY && this.toUpload.length) {
      const id = this.toUpload.shift()!;
      const job = this.jobs.get(id);
      if (job?.blob) void this.upload(id, job, job.blob);
    }
  }

  private async upload(id: string, job: Job, blob: Blob): Promise<void> {
    const controller = new AbortController();
    job.controller = controller;
    this.uploading += 1;
    let last = 0;
    const result = await this.transport(blob, {
      signal: controller.signal,
      onProgress: (percent) => {
        if (percent === last || this.jobs.get(id) !== job) return;
        last = percent;
        this.patch(id, { progress: percent });
      },
    }).catch(() => ({ ok: false as const, error: UPLOAD_MESSAGES.failed, retryable: true }));
    this.uploading -= 1;
    job.controller = null;
    if (this.jobs.get(id) === job) {
      this.patch(
        id,
        result.ok
          ? { status: "done", progress: 100, ref: result.ref, error: null }
          : { status: "failed", error: result.error, retryable: result.retryable },
      );
    }
    this.pumpUpload();
  }

  /** When the connection comes back, failed uploads go again without a tap (Retry still works). */
  private onOnline = () => {
    for (const p of this.photos) if (p.status === "failed" && p.retryable) this.retry(p.id);
  };

  private listenForConnection(): void {
    if (this.listening || typeof window === "undefined") return;
    window.addEventListener("online", this.onOnline);
    this.listening = true;
  }
}
