import "server-only";

import { checkPhoto, MAX_TENANT_PHOTOS, PHOTO_MESSAGES, type CheckedPhoto } from "@/lib/tenant/photos";
import { TENANT_MESSAGES, validateReport, type SubmitResult } from "@/lib/tenant/report";

import { BOT_CHECK, issueStamp, verifyStamp } from "./bot-check";
import type { TenantRepo } from "./repo";
import { resolveWith } from "./resolve";

export type { SubmitResult };

// T01-BTN-SUBMIT on the server. Order: resolve the token (the only identifier trusted; nothing
// in the form can name a landlord, unit or tenancy) → invisible bot check → validation → rate
// limit → photos → create. Nothing waits on the assistant: there is no assistant call here at all
// (D-21 suggestions run outside tenant code; see the PR's integration requirements).

/** T-01 Rules: 5 submissions per hour. Counted per resolved tenancy, so the door sticker and the
 * tenant link share one budget: stricter than "per token", never looser (the schema cannot tell
 * which link made a request). */
export const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 } as const;

export interface SubmitDeps {
  repo: TenantRepo;
  botKey: Uint8Array;
  now: () => Date;
  /** Called once the request exists, with the kind of link that made it (T-02 confirmation). */
  onReported?: (kind: "door" | "tenant", requestNumber: string) => void;
}

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

async function readPhotos(form: FormData): Promise<{ ok: true; photos: CheckedPhoto[] } | { ok: false; message: string }> {
  const files = form.getAll("photo").filter((part): part is File => typeof part !== "string" && part.size > 0);
  if (files.length > MAX_TENANT_PHOTOS) return { ok: false, message: PHOTO_MESSAGES.count };
  const photos: CheckedPhoto[] = [];
  for (const file of files) {
    const checked = checkPhoto(new Uint8Array(await file.arrayBuffer()));
    if (!checked.ok) return checked;
    photos.push({ bytes: checked.bytes, mime: checked.mime, extension: checked.extension });
  }
  return { ok: true, photos };
}

export async function submitReportWith(deps: SubmitDeps, token: unknown, form: FormData): Promise<SubmitResult> {
  const resolved = await resolveWith(deps.repo, token);
  if (!resolved || typeof token !== "string") return { status: "invalid-link" };

  const nowMs = deps.now().getTime();
  if (field(form, BOT_CHECK.honeypotField) !== "") return { status: "retry", message: TENANT_MESSAGES.submitFailed };
  const stamp = verifyStamp(deps.botKey, token, form.get(BOT_CHECK.stampField), nowMs);
  if (stamp === "expired") {
    return { status: "retry", message: TENANT_MESSAGES.submitFailed, stamp: issueStamp(deps.botKey, token, nowMs) };
  }
  if (stamp !== "ok") return { status: "retry", message: TENANT_MESSAGES.submitFailed };

  const report = validateReport({
    category: field(form, "category"),
    description: field(form, "description"),
    urgency: field(form, "urgency"),
    name: field(form, "name"),
    phone: field(form, "phone"),
  });
  const photos = await readPhotos(form);
  if (!report.ok || !photos.ok) {
    return {
      status: "fields",
      errors: { ...(report.ok ? {} : report.errors), ...(photos.ok ? {} : { photos: photos.message }) },
    };
  }

  try {
    const since = new Date(nowMs - RATE_LIMIT.windowMs);
    if ((await deps.repo.countTenantLinkRequestsSince(resolved.scope, since)) >= RATE_LIMIT.max) {
      return { status: "retry", message: TENANT_MESSAGES.rateLimited };
    }
    const created = await deps.repo.createRequest(resolved.scope, { report: report.value, photos: photos.photos });
    try {
      deps.onReported?.(resolved.view.kind, created.requestNumber);
    } catch {
      // The request exists; saying "Could not submit" now would invite a duplicate. Without the
      // confirmation a door-token T-02 shows E1-10, which is the safe side.
    }
    return { status: "reported", requestNumber: created.requestNumber };
  } catch (error) {
    // The step and code only (repo.ts never puts row values in its messages); never the token.
    console.error(error instanceof Error ? error.message : "tenant submit: unknown");
    return { status: "retry", message: TENANT_MESSAGES.submitFailed };
  }
}
