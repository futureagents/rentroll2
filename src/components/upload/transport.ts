// S-04 · how a prepared photo reaches storage. The uploader does not know where files go: each
// screen passes a transport. The one used for the private `documents` bucket (D-15) is
// `signedUrlTransport`: the screen's server action signs a one-time upload URL for
// `<landlord_id>/<document_id>` and the browser PUTs the bytes there with real progress. The
// browser never holds a storage credential, and nothing is attached to a record until the
// screen's own save runs with the returned refs.
import { publicEnv } from "@/lib/env";

import { STALL_MS, UPLOAD_MESSAGES } from "./limits";

export type UploadResult =
  | { ok: true; ref: string }
  | { ok: false; error: string; retryable: boolean };

export interface UploadContext {
  /** 0–100. */
  onProgress: (percent: number) => void;
  /** Aborted when the photo is removed. */
  signal: AbortSignal;
}

export type UploadTransport = (blob: Blob, context: UploadContext) => Promise<UploadResult>;

/** What a screen's signing server action returns. `ref` is what its save action later receives. */
export type SignedUpload = { ok: true; signedUrl: string; ref: string } | { ok: false; error: string };
export type UploadSigner = (file: { mime: string; size: number }) => Promise<SignedUpload>;

type PutResult = { ok: true } | { ok: false; status: number; body: string };

/**
 * PUT with upload progress, abort, and a stall timer: on weak 4G an upload can hang with no
 * error at all, so no progress for STALL_MS fails it and the photo offers Retry.
 */
export function putWithProgress(
  url: string,
  body: Blob,
  { onProgress, signal }: UploadContext,
  headers: Record<string, string> = {},
): Promise<PutResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let stall: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: PutResult) => {
      clearTimeout(stall);
      signal.removeEventListener("abort", abort);
      resolve(result);
    };
    const arm = () => {
      clearTimeout(stall);
      stall = setTimeout(() => xhr.abort(), STALL_MS);
    };
    const abort = () => xhr.abort();

    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      arm();
      // Held at 99 until the server answers: the bytes are out, the file is not yet stored.
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.upload.onload = arm;
    xhr.onload = () =>
      finish(xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false, status: xhr.status, body: String(xhr.responseText ?? "") });
    xhr.onerror = () => finish({ ok: false, status: 0, body: "" });
    xhr.onabort = () => finish({ ok: false, status: 0, body: "" });
    signal.addEventListener("abort", abort);
    arm();
    xhr.send(body);
  });
}

/**
 * Uploads to a one-time signed URL from `sign`. A photo keeps its signed URL across retries, so
 * an upload whose reply was lost on a dropped connection is not stored twice: the retry's 409
 * ("already exists") means the first attempt landed. Signed upload URLs last two hours; an
 * expired one is signed again.
 */
export function signedUrlTransport(sign: UploadSigner): UploadTransport {
  const signed = new WeakMap<Blob, { signedUrl: string; ref: string; at: number; sent: boolean }>();
  const LIFETIME_MS = 110 * 60 * 1000;

  return async (blob, context) => {
    let slot = signed.get(blob);
    if (!slot || Date.now() - slot.at > LIFETIME_MS) {
      let answer: SignedUpload;
      try {
        answer = await sign({ mime: blob.type, size: blob.size });
      } catch {
        return { ok: false, error: UPLOAD_MESSAGES.failed, retryable: true }; // offline, or the action failed
      }
      if (!answer.ok) {
        const final = answer.error === UPLOAD_MESSAGES.tooLarge || answer.error === UPLOAD_MESSAGES.notSupported;
        return { ok: false, error: final ? answer.error : UPLOAD_MESSAGES.failed, retryable: !final };
      }
      slot = { signedUrl: answer.signedUrl, ref: answer.ref, at: Date.now(), sent: false };
      signed.set(blob, slot);
    }
    if (context.signal.aborted) return { ok: false, error: UPLOAD_MESSAGES.failed, retryable: true };

    const retrying = slot.sent;
    slot.sent = true;
    const put = await putWithProgress(slot.signedUrl, blob, context, {
      "content-type": blob.type,
      "x-upsert": "false",
      apikey: publicEnv().supabaseAnonKey, // the public key; the signed token is the authority
    });
    if (put.ok) return { ok: true, ref: slot.ref };
    // Storage answers a duplicate with 409, or with 400 and "Duplicate" in the body on some versions.
    const duplicate = put.status === 409 || /duplicate|already exists/i.test(put.body);
    if (retrying && duplicate) return { ok: true, ref: slot.ref };
    if (!duplicate && (put.status === 400 || put.status === 403)) signed.delete(blob); // token refused: sign afresh
    if (put.status === 413) return { ok: false, error: UPLOAD_MESSAGES.tooLarge, retryable: false };
    if (put.status === 415) return { ok: false, error: UPLOAD_MESSAGES.notSupported, retryable: false };
    return { ok: false, error: UPLOAD_MESSAGES.failed, retryable: true };
  };
}
