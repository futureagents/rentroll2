// S-03 · the clipboard write happens synchronously inside the click, never after an await.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../src/components/ui/share";

const shareSource = readFileSync(path.resolve(__dirname, "../src/components/ui/share.tsx"), "utf8")
  // Code only: the comments explain the rule and so mention the word.
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S03-BTN-COPY copyText", () => {
  it("calls the clipboard synchronously, before any await could run", () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(copyText("https://rentroll.example/u/abc")).toBe(true);
    // Checked on the same tick: a handler that awaited first would not have called it yet.
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("https://rentroll.example/u/abc");
  });

  it("reports false when no clipboard route exists", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", undefined);
    expect(copyText("x")).toBe(false);
  });

  it("has no await anywhere in the share and copy module", () => {
    expect(shareSource).not.toMatch(/\bawait\b|\basync\b/);
  });
});
