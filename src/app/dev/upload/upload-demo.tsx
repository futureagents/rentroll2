"use client";
// /dev/upload · S-04 demo: the tenant limit (3) and the landlord limit (10) side by side, each
// with a report form whose Submit waits for uploads, and buttons that make the hard cases on
// demand. Signed in, photos go to the real private `documents` bucket through the L-09 signer
// (startUploadAction: a one-time URL in the landlord's own folder, D-15). Nothing is attached to
// any record, so a photo uploaded here is an unattached object in that folder. Signed out, the
// upload is simulated and the page says so.
import { useRef, useState } from "react";

import { startUploadAction } from "@/app/(landlord)/units/actions";
import { Button, TextArea } from "@/components/ui";
import {
  LANDLORD_PHOTO_LIMIT,
  PhotoUploader,
  TENANT_PHOTO_LIMIT,
  UPLOAD_MESSAGES,
  focusFirstFailedPhoto,
  signedUrlTransport,
  useUploadQueue,
  type QueuedPhoto,
  type UploadContext,
  type UploadTransport,
} from "@/components/upload";

import { cameraPhoto, heicPhoto, oversizedPhoto, rotatedPhoto } from "./demo-files";

type Storage = "real" | "simulated";

interface Armed {
  slow: boolean;
  fail: boolean;
}

export function UploadDemo({ storage, landlordName, signInHref }: { storage: Storage; landlordName: string | null; signInHref: string }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">S-04 · Photo uploader</h1>
        {storage === "real" ? (
          <p className="text-small text-body">
            Signed in as {landlordName}. Photos upload to the real <code>documents</code> bucket, in your own folder, and are not
            attached to any record.
          </p>
        ) : (
          <p className="rounded-sm border border-warning bg-warning/12 p-2 text-small text-ink">
            Signed out: uploads are simulated and nothing reaches storage.{" "}
            <a className="text-primary underline" href={signInHref}>
              Sign in
            </a>{" "}
            to upload to the real bucket.
          </p>
        )}
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DemoColumn title="Tenant screen" max={TENANT_PHOTO_LIMIT} storage={storage} />
        <DemoColumn title="Landlord screen" max={LANDLORD_PHOTO_LIMIT} storage={storage} />
      </div>
    </div>
  );
}

function DemoColumn({ title, max, storage }: { title: string; max: number; storage: Storage }) {
  // The transport reads the flags at upload time; `armedView` mirrors them for the buttons. Both
  // are created once, as the queue reads its transport once.
  const [armedView, setArmedView] = useState<Armed>({ slow: false, fail: false });
  const [simulation] = useState(() => new Simulation(setArmedView));
  const [transport] = useState(() => demoTransport(storage, simulation));
  const { queue, photos } = useUploadQueue({ max, transport, altFor: (i) => `Photo ${i + 1} of the problem` });
  const [description, setDescription] = useState("");
  // Submit waits for uploads while typing continues, so it must send the text as it is when the
  // wait ends, not as it was when Submit was pressed.
  const latestDescription = useRef("");
  const describe = (value: string) => {
    latestDescription.current = value;
    setDescription(value);
  };
  const [phase, setPhase] = useState<"editing" | "waiting" | "submitted">("editing");
  const [submitted, setSubmitted] = useState<{ description: string; photos: readonly QueuedPhoto[] } | null>(null);
  const [making, setMaking] = useState<string | null>(null);

  const addMade = async (name: string, make: () => Promise<File> | File) => {
    setMaking(name);
    try {
      queue.add([await make()]);
    } finally {
      setMaking(null);
    }
  };

  const submit = async () => {
    setPhase("waiting");
    const settled = await queue.whenSettled();
    if (settled.some((p) => p.status === "failed")) {
      // The error is already on the thumbnail; point at it rather than repeat it elsewhere.
      setPhase("editing");
      focusFirstFailedPhoto(queue);
      return;
    }
    setSubmitted({ description: latestDescription.current, photos: settled });
    setPhase("submitted");
  };
  const startAgain = () => {
    queue.dispose();
    describe("");
    setSubmitted(null);
    setPhase("editing");
  };

  const full = photos.length >= max;
  return (
    <section className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-1" aria-labelledby={`${title}-h`}>
      <h2 id={`${title}-h`} className="text-h2 text-ink">
        {title} · up to {max} photos
      </h2>

      {phase === "submitted" && submitted ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-body text-success">
            Submitted with {submitted.photos.length} {submitted.photos.length === 1 ? "photo" : "photos"}
            {storage === "real" ? ", each stored in the bucket." : " (simulated)."}
          </p>
          <p className="text-small text-body">“{submitted.description || "No description"}”</p>
          <PhotoTable photos={submitted.photos} />
          <div>
            <Button variant="secondary" onClick={startAgain}>
              Start again
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (phase === "editing") void submit();
          }}
        >
          <TextArea
            label="What is the problem?"
            value={description}
            onChange={describe}
            minLines={3}
            helper="Typing is never blocked by an upload."
          />
          <PhotoUploader queue={queue} label="Add a photo" />
          <Button type="submit" size={48} loading={phase === "waiting"} block>
            {phase === "waiting" ? UPLOAD_MESSAGES.uploading : "Submit report"}
          </Button>
        </form>
      )}

      {phase !== "submitted" && (
        <fieldset className="flex flex-col gap-2 border-t border-line pt-3">
          <legend className="text-label uppercase text-muted">Simulate</legend>
          <div className="flex flex-wrap gap-2">
            {/* Armed shows as the filled style and aria-pressed; the label stays put so nothing reflows. */}
            <Button variant={armedView.slow ? "primary" : "secondary"} size={48} aria-pressed={armedView.slow} onClick={() => simulation.toggle("slow")}>
              Slow upload
            </Button>
            <Button variant={armedView.fail ? "primary" : "secondary"} size={48} aria-pressed={armedView.fail} onClick={() => simulation.toggle("fail")}>
              Failed upload
            </Button>
            {(
              [
                ["Oversized file", oversizedPhoto],
                ["HEIC file", heicPhoto],
                ["Rotated photo", rotatedPhoto],
                ["12 MP photo", cameraPhoto],
              ] as const
            ).map(([name, make]) =>
              full ? (
                <Button key={name} variant="secondary" size={48} disabled disabledReason={`Already ${max} photos`}>
                  {name}
                </Button>
              ) : (
                <Button key={name} variant="secondary" size={48} loading={making === name} onClick={() => void addMade(name, make)}>
                  {name}
                </Button>
              ),
            )}
          </div>
          <p className="text-small text-muted">
            {armedView.slow || armedView.fail
              ? `Armed: the next upload ${armedView.slow && armedView.fail ? "fails, the one after is slow" : armedView.fail ? "fails" : "is slow"}. `
              : ""}
            Slow and Failed apply to the next upload attempt only, so Retry then succeeds. Slow holds the upload back for about 15
            seconds before it really starts; for a true slow link use the browser&apos;s network throttling.
          </p>
          {photos.length > 0 && <PhotoTable photos={photos} />}
        </fieldset>
      )}
    </section>
  );
}

function PhotoTable({ photos }: { photos: readonly QueuedPhoto[] }) {
  return (
    <table className="w-full text-left text-small">
      <thead className="text-label uppercase text-muted">
        <tr>
          <th className="py-1 pr-2 font-semibold">Photo</th>
          <th className="py-1 pr-2 font-semibold">Picked → sent</th>
          <th className="py-1 pr-2 font-semibold">Size</th>
          <th className="py-1 font-semibold">State</th>
        </tr>
      </thead>
      <tbody>
        {photos.map((p, i) => (
          <tr key={p.id} className="border-t border-line align-top">
            <td className="py-1 pr-2">{i + 1}</td>
            <td className="py-1 pr-2">
              {bytes(p.originalBytes)} → {p.uploadBytes === null ? "…" : bytes(p.uploadBytes)}
            </td>
            <td className="py-1 pr-2">{p.width ? `${p.width}×${p.height}` : "…"}</td>
            <td className="py-1 break-all">{p.status === "done" ? `Stored ${p.ref}` : (p.error ?? p.status)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Dev-only display of a byte count; not money or a date, so no shared formatter applies. */
function bytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const timer = setTimeout(() => resolve(true), ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/** Moves the ring from `from` to `to` over `ms`. False if the photo was removed meanwhile. */
async function creep(context: UploadContext, from: number, to: number, ms: number): Promise<boolean> {
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    if (!(await wait(ms / steps, context.signal))) return false;
    context.onProgress(Math.round(from + ((to - from) * i) / steps));
  }
  return true;
}

let simulatedCount = 0;
const simulated: UploadTransport = async (_blob, context) => {
  if (!(await creep(context, 0, 99, 2500))) return { ok: false, error: UPLOAD_MESSAGES.failed, retryable: true };
  return { ok: true, ref: `simulated-${++simulatedCount}` };
};

const real: UploadTransport = signedUrlTransport(async ({ mime, size }) => {
  const started = await startUploadAction({ type: "move_in_photo", mime, size });
  return started.ok
    ? { ok: true, signedUrl: started.upload.signedUrl, ref: started.upload.documentId }
    : { ok: false, error: started.error };
});

/** "Next upload slow / fails": each flag applies to one upload attempt, then clears. */
class Simulation {
  private armed: Armed = { slow: false, fail: false };
  constructor(private readonly onChange: (armed: Armed) => void) {}

  toggle(key: keyof Armed): void {
    this.armed = { ...this.armed, [key]: !this.armed[key] };
    this.onChange(this.armed);
  }

  take(key: keyof Armed): boolean {
    if (!this.armed[key]) return false;
    this.armed = { ...this.armed, [key]: false };
    this.onChange(this.armed);
    return true;
  }
}

function demoTransport(storage: Storage, simulation: Simulation): UploadTransport {
  const base = storage === "real" ? real : simulated;
  return async (blob, context) => {
    if (simulation.take("fail")) {
      await creep(context, 0, 40, 1500);
      return { ok: false, error: UPLOAD_MESSAGES.failed, retryable: true };
    }
    if (simulation.take("slow")) {
      if (!(await creep(context, 0, 60, 15000))) return { ok: false, error: UPLOAD_MESSAGES.failed, retryable: true };
      return base(blob, { ...context, onProgress: (p) => context.onProgress(60 + Math.round(p * 0.4)) });
    }
    return base(blob, context);
  };
}
