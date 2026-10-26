// G-1 · S-01 is the only send path (lane/composer: src/server/composer/record.ts is the only
// writer of `message`; only src/components/composer hands a message to WhatsApp, mail or SMS).
// The maintenance lane opens S-01 and never bypasses it. Mirrors the composer lane's
// single-send-path checks for this lane's files, so a regression fails here before it merges.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const lane = path.resolve(__dirname, "..", "..", "src", "app", "(landlord)", "maintenance");
const files = readdirSync(lane, { recursive: true, encoding: "utf8" })
  .filter((entry) => /\.(ts|tsx)$/.test(entry))
  .map((entry) => ({ file: entry, text: readFileSync(path.join(lane, entry), "utf8") }));

describe("maintenance lane has no send path (G-1)", () => {
  it("finds the lane's files", () => {
    expect(files.some(({ file }) => file === "actions.ts")).toBe(true);
  });

  it("never writes the message table", () => {
    const WRITE = /from\(\s*["'`]message["'`]\s*\)[\s\S]{0,400}?\.(?:insert|upsert|update|delete)\s*\(/;
    expect(files.filter(({ text }) => WRITE.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it("never builds a pre-filled WhatsApp, mail or SMS hand-off", () => {
    const PREFILL = [/wa\.me/, /api\.whatsapp\.com/, /whatsapp:\/\//, /mailto:[^"'`\s]*[?&]body=/, /sms:[^"'`\s]*[?&]body=/];
    const offenders = files
      .filter(
        ({ text }) =>
          PREFILL.some((pattern) => pattern.test(text)) ||
          (/wa\.me|whatsapp/i.test(text) && /[?&]text=|\btext\s*:/.test(text) && /encodeURIComponent|URLSearchParams/.test(text)),
      )
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
