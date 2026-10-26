// S-01 · Composer state machine. Pure, so the G-1 path is testable: the only transition into
// "saving" (the one that writes a `message` row) is "yes" from "confirming", and "confirming" is
// reached only after a hand-off. Cancel, "Not yet", tone changes and regeneration never write.
import type { Tone } from "./ladder";
import type { SendChannel } from "./types";

export type DraftSource = "assistant" | "template";

export interface ComposerState {
  phase: "drafting" | "editing" | "confirming" | "saving" | "closed";
  tone: Tone;
  /** Which template wording is in the field; S01-BTN-REGENERATE moves it on. */
  variant: number;
  /** S01-FLD-MESSAGE as the landlord sees it. */
  text: string;
  /** The last text the system put in the field; the message is "edited" when text differs. */
  drafted: string;
  source: DraftSource;
  /** Edits kept by "Write it differently" so they can be restored (S01-BTN-REGENERATE). */
  restorable: string | null;
  includePayLink: boolean;
  channel: SendChannel | null;
  /** Id of the message row this hand-off would record; a retried "Yes" reuses it (idempotent). */
  sendId: string | null;
  /** A tone change waiting on "This will replace your edits." */
  pendingTone: Tone | null;
  /** Cancel waiting on the discard confirmation. */
  confirmingCancel: boolean;
  saveFailed: boolean;
  /** True only after "Yes" was saved: the opener refreshes its row. */
  recorded: boolean;
  /** Bumped on every draft request so a late answer for an older request is ignored. */
  draftRequest: number;
}

export type ComposerEvent =
  | { type: "drafted"; text: string; source: DraftSource; request: number }
  | { type: "edit"; text: string }
  | { type: "chooseTone"; tone: Tone }
  | { type: "replaceEdits" }
  | { type: "keepEdits" }
  | { type: "regenerate" }
  | { type: "restore" }
  | { type: "togglePayLink"; on: boolean }
  | { type: "handedOff"; channel: SendChannel; sendId: string }
  | { type: "notYet" }
  | { type: "yes" }
  | { type: "saved" }
  | { type: "saveFailed" }
  | { type: "cancel" }
  | { type: "discard" }
  | { type: "keepEditing" };

export function initialState(tone: Tone, includePayLink: boolean): ComposerState {
  return {
    phase: "drafting",
    tone,
    variant: 0,
    text: "",
    drafted: "",
    source: "template",
    restorable: null,
    includePayLink,
    channel: null,
    sendId: null,
    pendingTone: null,
    confirmingCancel: false,
    saveFailed: false,
    recorded: false,
    draftRequest: 1,
  };
}

export function isEdited(state: ComposerState): boolean {
  return state.phase !== "drafting" && state.text !== state.drafted;
}

function redraft(state: ComposerState, tone: Tone, variant: number): ComposerState {
  return {
    ...state,
    phase: "drafting",
    tone,
    variant,
    pendingTone: null,
    draftRequest: state.draftRequest + 1,
  };
}

export function reduce(state: ComposerState, event: ComposerEvent): ComposerState {
  switch (event.type) {
    case "drafted":
      if (state.phase !== "drafting" || event.request !== state.draftRequest) return state;
      return { ...state, phase: "editing", text: event.text, drafted: event.text, source: event.source };

    case "edit":
      return state.phase === "editing" ? { ...state, text: event.text } : state;

    case "chooseTone":
      if (state.phase !== "editing" || event.tone === state.tone) return state;
      // S01-SEG-TONE: "If the message has been edited, warn before regenerating."
      if (isEdited(state)) return { ...state, pendingTone: event.tone };
      return { ...redraft(state, event.tone, 0), restorable: null };

    case "replaceEdits":
      if (state.phase !== "editing" || !state.pendingTone) return state;
      return { ...redraft(state, state.pendingTone, 0), restorable: null };

    case "keepEdits":
      return { ...state, pendingTone: null };

    case "regenerate":
      if (state.phase !== "editing") return state;
      // "keeping any edits in a restorable state"
      return {
        ...redraft(state, state.tone, state.variant + 1),
        restorable: isEdited(state) ? state.text : state.restorable,
      };

    case "restore":
      if (state.phase !== "editing" || state.restorable === null) return state;
      return { ...state, text: state.restorable, restorable: null };

    case "togglePayLink":
      return state.phase === "editing" ? { ...state, includePayLink: event.on } : state;

    case "handedOff":
      if (state.phase !== "editing" || state.text.trim() === "") return state;
      return { ...state, phase: "confirming", channel: event.channel, sendId: event.sendId, saveFailed: false };

    case "notYet":
      // D-17: "Not yet" returns to the composer with the draft intact.
      return state.phase === "confirming" ? { ...state, phase: "editing", channel: null, sendId: null } : state;

    case "yes":
      return state.phase === "confirming" ? { ...state, phase: "saving", saveFailed: false } : state;

    case "saved":
      return state.phase === "saving" ? { ...state, phase: "closed", recorded: true } : state;

    case "saveFailed":
      return state.phase === "saving" ? { ...state, phase: "confirming", saveFailed: true } : state;

    case "cancel":
      if (state.phase === "saving" || state.phase === "closed") return state;
      // S01-BTN-CANCEL: "Closes with no record written. If edited, confirm first."
      if (isEdited(state)) return { ...state, confirmingCancel: true };
      return { ...state, phase: "closed" };

    case "discard":
      return state.confirmingCancel ? { ...state, phase: "closed", confirmingCancel: false } : state;

    case "keepEditing":
      return { ...state, confirmingCancel: false };
  }
}
