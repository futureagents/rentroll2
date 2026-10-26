// S-01 · Where a draft comes from. S-01b: the assistant, server-side (D-37), raced against the
// 4-second ceiling (E3). If it fails, refuses or is slow, the template appears with the E1-09
// note. The composer is never blocked by the assistant: this promise always settles by the
// ceiling, and a late answer is discarded.
import { draftMessage } from "./actions";
import type { Tone } from "./ladder";
import type { DraftSource } from "./machine";
import { rentReminderTemplate } from "./templates";
import type { ComposerContext } from "./types";

/** E3: "a 4-second ceiling before falling back to a template". */
export const DRAFT_CEILING_MS = 4000;

export interface Draft {
  text: string;
  source: DraftSource;
}

export function templateDraft(context: ComposerContext, tone: Tone, variant: number): Draft {
  return { text: rentReminderTemplate(context, tone, variant), source: "template" };
}

export function requestDraft(
  context: ComposerContext,
  tone: Tone,
  variant: number,
  assistant: typeof draftMessage = draftMessage,
): Promise<Draft> {
  const fallback = templateDraft(context, tone, variant);
  return new Promise<Draft>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), DRAFT_CEILING_MS);
    assistant({ rentEntryId: context.rentEntryId, tone, variant })
      .then((result) => resolve(result.text ? { text: result.text, source: "assistant" } : fallback))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}
