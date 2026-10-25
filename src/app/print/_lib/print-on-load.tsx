"use client";
// Print views open in a new tab "with the print dialog triggered on load" (P-01/P-02/P-03
// rules). Waits for fonts and any images (the landlord logo) so the preview is complete,
// then calls window.print() exactly once. Renders nothing.
import { useEffect } from "react";

const IMAGE_WAIT_MS = 1500;

function imageSettled(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    window.setTimeout(done, IMAGE_WAIT_MS);
  });
}

export function PrintOnLoad({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      await Promise.all([
        document.fonts?.ready ?? Promise.resolve(),
        ...Array.from(document.images).map(imageSettled),
      ]);
      if (!cancelled) window.print();
    };
    const timer = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);
  return null;
}
