// S-01 composer state machine: the G-1 path. Only "Yes" after a hand-off reaches "saving",
// which is the one state that writes a message row (D-17).
import { describe, expect, it } from "vitest";

import { initialState, isEdited, reduce, type ComposerEvent, type ComposerState } from "@/components/composer/machine";

function run(events: ComposerEvent[], start = initialState("gentle", true)): ComposerState {
  return events.reduce(reduce, start);
}

const SEND_ID = "5b0f3c7e-1d2a-4c3b-8e9f-0a1b2c3d4e5f";

const drafted = (text = "Hi Suresh, rent reminder.", request = 1): ComposerEvent => ({
  type: "drafted",
  text,
  source: "template",
  request,
});

describe("S-01 send confirmation", () => {
  it("writes only on Yes after a hand-off", () => {
    const confirming = run([drafted(), { type: "handedOff", channel: "whatsapp", sendId: SEND_ID }]);
    expect(confirming.phase).toBe("confirming");
    expect(reduce(confirming, { type: "yes" }).phase).toBe("saving");
  });

  it("cannot reach saving from editing, drafting or any other event", () => {
    const editing = run([drafted()]);
    const all: ComposerEvent[] = [
      { type: "yes" },
      { type: "saved" },
      { type: "edit", text: "x" },
      { type: "chooseTone", tone: "formal" },
      { type: "regenerate" },
      { type: "togglePayLink", on: false },
      { type: "cancel" },
      { type: "notYet" },
    ];
    for (const event of all) {
      expect(reduce(editing, event).phase).not.toBe("saving");
      expect(reduce(initialState("direct", false), event).phase).not.toBe("saving");
    }
  });

  it("Not yet returns to editing with the draft intact (D-17)", () => {
    const state = run([
      drafted(),
      { type: "edit", text: "Edited text" },
      { type: "handedOff", channel: "copy", sendId: SEND_ID },
      { type: "notYet" },
    ]);
    expect(state.phase).toBe("editing");
    expect(state.text).toBe("Edited text");
    expect(state.recorded).toBe(false);
  });

  it("a failed save stays on Did you send it? and can be retried", () => {
    const failed = run([drafted(), { type: "handedOff", channel: "email", sendId: SEND_ID }, { type: "yes" }, { type: "saveFailed" }]);
    expect(failed.phase).toBe("confirming");
    expect(failed.saveFailed).toBe(true);
    const saved = run([{ type: "yes" }, { type: "saved" }], failed);
    expect(saved.phase).toBe("closed");
    expect(saved.recorded).toBe(true);
  });

  it("keeps one send id per hand-off, so a retried Yes cannot record twice", () => {
    const failed = run([drafted(), { type: "handedOff", channel: "whatsapp", sendId: SEND_ID }, { type: "yes" }, { type: "saveFailed" }]);
    expect(reduce(failed, { type: "yes" }).sendId).toBe(SEND_ID);
    const back = reduce(failed, { type: "notYet" });
    expect(back.sendId).toBeNull();
    const next = reduce(back, { type: "handedOff", channel: "copy", sendId: "another" });
    expect(next.sendId).toBe("another");
  });

  it("does not hand off an empty message", () => {
    const state = run([drafted(), { type: "edit", text: "   " }, { type: "handedOff", channel: "whatsapp", sendId: SEND_ID }]);
    expect(state.phase).toBe("editing");
  });
});

describe("S01-BTN-CANCEL", () => {
  it("closes unedited with no record", () => {
    const state = run([drafted(), { type: "cancel" }]);
    expect(state.phase).toBe("closed");
    expect(state.recorded).toBe(false);
  });

  it("confirms first when edited, and Keep editing keeps the text", () => {
    const asked = run([drafted(), { type: "edit", text: "Mine" }, { type: "cancel" }]);
    expect(asked.phase).toBe("editing");
    expect(asked.confirmingCancel).toBe(true);
    const kept = reduce(asked, { type: "keepEditing" });
    expect(kept.text).toBe("Mine");
    const discarded = reduce(asked, { type: "discard" });
    expect(discarded.phase).toBe("closed");
    expect(discarded.recorded).toBe(false);
  });

  it("closes from Did you send it? without a record", () => {
    const state = run([drafted(), { type: "handedOff", channel: "whatsapp", sendId: SEND_ID }, { type: "cancel" }]);
    expect(state.phase).toBe("closed");
    expect(state.recorded).toBe(false);
  });
});

describe("S01-SEG-TONE and S01-BTN-REGENERATE", () => {
  it("regenerates straight away when the message is unedited", () => {
    const state = run([drafted(), { type: "chooseTone", tone: "direct" }]);
    expect(state.phase).toBe("drafting");
    expect(state.tone).toBe("direct");
  });

  it("warns before replacing edits, and keeps them on Keep my edits", () => {
    const asked = run([drafted(), { type: "edit", text: "Mine" }, { type: "chooseTone", tone: "formal" }]);
    expect(asked.pendingTone).toBe("formal");
    expect(asked.tone).toBe("gentle");
    const kept = reduce(asked, { type: "keepEdits" });
    expect(kept.text).toBe("Mine");
    expect(kept.tone).toBe("gentle");
    const replaced = reduce(asked, { type: "replaceEdits" });
    expect(replaced.tone).toBe("formal");
    expect(replaced.phase).toBe("drafting");
  });

  it("Write it differently keeps edits restorable", () => {
    const state = run([drafted(), { type: "edit", text: "Mine" }, { type: "regenerate" }, drafted("Second wording", 2)]);
    expect(state.text).toBe("Second wording");
    expect(state.variant).toBe(1);
    expect(state.restorable).toBe("Mine");
    const restored = reduce(state, { type: "restore" });
    expect(restored.text).toBe("Mine");
    expect(isEdited(restored)).toBe(true);
  });

  it("ignores a draft that answers an older request", () => {
    const state = run([drafted(), { type: "chooseTone", tone: "direct" }, drafted("stale answer", 1)]);
    expect(state.phase).toBe("drafting");
    expect(reduce(state, drafted("fresh", 2)).text).toBe("fresh");
  });
});
