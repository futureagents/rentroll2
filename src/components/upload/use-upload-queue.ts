"use client";
// S-04 · the screen's handle on its upload queue. Created once per screen, kept for the screen's
// life: the queue is not disposed on unmount, so a remounted uploader finds its photos still
// uploading. Call `queue.dispose()` after the screen has saved.
import { useState, useSyncExternalStore } from "react";

import { UploadQueue, type QueuedPhoto, type UploadQueueOptions } from "./queue";

export interface UploadQueueState {
  queue: UploadQueue;
  photos: readonly QueuedPhoto[];
  /** Any photo still preparing or uploading: a submit now must wait (S-04). */
  busy: boolean;
  /** Photos that failed and still need Retry or Remove. */
  failed: readonly QueuedPhoto[];
}

/** `options` are read once, on the first render. Pass a stable transport. */
export function useUploadQueue(options: UploadQueueOptions): UploadQueueState {
  const [queue] = useState(() => new UploadQueue(options));
  return useQueueState(queue);
}

export function useQueueState(queue: UploadQueue): UploadQueueState {
  const photos = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  return {
    queue,
    photos,
    busy: photos.some((p) => p.status === "preparing" || p.status === "uploading"),
    failed: photos.filter((p) => p.status === "failed"),
  };
}
