// S-01 · Where a draft comes from. S-01a: the template for the tone and variant (E1-09 note
// shown). The composer never waits on anything but this promise.
import type { Tone } from "./ladder";
import type { DraftSource } from "./machine";
import { rentReminderTemplate } from "./templates";
import type { ComposerContext } from "./types";

export interface Draft {
  text: string;
  source: DraftSource;
}

export function templateDraft(context: ComposerContext, tone: Tone, variant: number): Draft {
  return { text: rentReminderTemplate(context, tone, variant), source: "template" };
}

export async function requestDraft(context: ComposerContext, tone: Tone, variant: number): Promise<Draft> {
  return templateDraft(context, tone, variant);
}
