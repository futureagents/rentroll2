"use server";

// S-01 · Server functions behind the composer. They are reachable by direct POST, so each one
// validates its input and runs under the caller's own RLS session (D-04). Only the composer modal
// imports this file (tests/composer/single-send-path.test.ts).
import { draftRentReminder } from "@/server/composer/assistant";
import { isUuid, loadRentReminder } from "@/server/composer/load";
import { recordConfirmedSend } from "@/server/composer/record";

import { TONES, type Tone } from "./ladder";
import type { ComposerTarget, ConfirmSentInput, ConfirmSentResult, LoadResult } from "./types";

const CHANNELS = new Set(["whatsapp", "copy", "email"]);
const MAX_BODY = 4000;

export async function openComposer(target: ComposerTarget): Promise<LoadResult> {
  if (target?.kind !== "rent_reminder" || !isUuid(target.rentEntryId)) {
    return { ok: false, reason: "not_found" };
  }
  return loadRentReminder(target.rentEntryId);
}

/**
 * S-01b: an assistant draft for the field, or null for the template (E1-09). Reloads the entry
 * under the caller's RLS so the model only ever sees the caller's own data (D-37). Never sends.
 */
export async function draftMessage(input: {
  rentEntryId: string;
  tone: Tone;
  variant: number;
}): Promise<{ text: string | null }> {
  const valid =
    isUuid(input?.rentEntryId) &&
    TONES.some((tone) => tone.value === input.tone) &&
    Number.isInteger(input.variant) &&
    input.variant >= 0 &&
    input.variant < 100;
  if (!valid) return { text: null };
  const load = await loadRentReminder(input.rentEntryId);
  if (!load.ok) return { text: null };
  const draft = await draftRentReminder(load.context, input.tone, input.variant);
  return { text: draft === null ? null : `${draft}\n\n— ${load.context.signOff}` };
}

/** "Did you send it?" → Yes. The one path that records a sent message (D-17). */
export async function confirmSent(input: ConfirmSentInput): Promise<ConfirmSentResult> {
  const valid =
    isUuid(input?.sendId) &&
    isUuid(input.rentEntryId) &&
    TONES.some((tone) => tone.value === input.tone) &&
    CHANNELS.has(input.channel) &&
    typeof input.body === "string" &&
    input.body.trim().length > 0 &&
    input.body.length <= MAX_BODY;
  if (!valid) return { ok: false };
  return recordConfirmedSend({ ...input, body: input.body.trim() });
}
