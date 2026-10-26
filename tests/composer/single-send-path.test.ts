// G-1 · S-01 is the only send path in the product. These checks make it structural: another
// module cannot hand a pre-filled message to WhatsApp, mail or SMS, cannot write a sent-message
// row, and cannot reach the composer's server functions or hand-off, without failing this test.
// L-05's logged call (D-17 kind `call`) is not a send; when that lane lands it records calls
// through src/server/composer, not by writing `message` itself.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const src = path.join(root, "src");

const files = readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter((entry) => /\.(ts|tsx|js|jsx|mjs)$/.test(entry))
  .map((entry) => ({ file: path.join("src", entry).split(path.sep).join("/"), text: readFileSync(path.join(src, entry), "utf8") }));

const inComposer = (file: string) => file.startsWith("src/components/composer/");
const inComposerServer = (file: string) => file.startsWith("src/server/composer/");

/** Imports of a module by specifier (relative or "@/"), resolved to a src-relative path. */
function importsOf(file: string, text: string): string[] {
  const specifiers = [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)].map((m) => m[1]);
  return specifiers.map((specifier) => {
    if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
    if (specifier.startsWith(".")) return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    return specifier;
  });
}

describe("G-1 single send path", () => {
  it("finds the source tree", () => {
    expect(files.some(({ file }) => file === "src/components/composer/handoff.ts")).toBe(true);
    expect(files.some(({ file }) => file === "src/server/composer/record.ts")).toBe(true);
  });

  it("builds pre-filled WhatsApp, mail and SMS hand-offs only in the composer", () => {
    const PREFILL = [
      /wa\.me\/[^"'`\s]*\?[^"'`\s]*text=/,
      /api\.whatsapp\.com\/send/,
      /whatsapp:\/\/send/,
      /mailto:[^"'`\s]*[?&]body=/,
      /sms:[^"'`\s]*[?&]body=/,
    ];
    const offenders = files
      .filter(({ file }) => !inComposer(file))
      .filter(({ text }) => PREFILL.some((pattern) => pattern.test(text)) || (/wa\.me|whatsapp/i.test(text) && /[?&]text=|\btext\s*:/.test(text) && /encodeURIComponent|URLSearchParams/.test(text)))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("writes the message table only in src/server/composer/record.ts", () => {
    const WRITE = /from\(\s*["'`]message["'`]\s*\)[\s\S]{0,400}?\.(?:insert|upsert|update|delete)\s*\(/;
    const offenders = files.filter(({ text }) => WRITE.test(text)).map(({ file }) => file);
    expect(offenders).toEqual(["src/server/composer/record.ts"]);
  });

  it("calls no messaging provider from anywhere", () => {
    const PROVIDER = /graph\.facebook\.com|api\.twilio\.com|api\.sendgrid\.com|api\.resend\.com|from\s+["'](?:twilio|nodemailer|resend|@sendgrid\/mail)["']/;
    expect(files.filter(({ text }) => PROVIDER.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it("keeps the composer's server functions, hand-off and writer private to the composer", () => {
    const PRIVATE = [
      "src/components/composer/actions",
      "src/components/composer/handoff",
      "src/server/composer/record",
      "src/server/composer/load",
      "src/server/composer/assistant",
    ];
    const offenders = files
      .filter(({ file }) => !inComposer(file) && !inComposerServer(file))
      .flatMap(({ file, text }) =>
        importsOf(file, text)
          .filter((target) => PRIVATE.some((p) => target === p || target.startsWith(`${p}.`) || target.startsWith("src/server/composer")))
          .map((target) => `${file} → ${target}`),
      );
    expect(offenders).toEqual([]);
  });

  it("imports the hand-off only from the composer modal", () => {
    const importers = files
      .filter(({ file, text }) => importsOf(file, text).includes("src/components/composer/handoff"))
      .map(({ file }) => file);
    expect(importers).toEqual(["src/components/composer/message-composer.tsx"]);
  });

  it("calls the record writer only from the composer's server functions", () => {
    const importers = files
      .filter(({ file, text }) => importsOf(file, text).includes("src/server/composer/record"))
      .map(({ file }) => file);
    expect(importers).toEqual(["src/components/composer/actions.ts"]);
  });

  it("exports neither server functions nor the hand-off from the composer barrel", () => {
    const barrel = files.find(({ file }) => file === "src/components/composer/index.ts")!.text;
    expect(importsOf("src/components/composer/index.ts", barrel)).toEqual([
      "src/components/composer/message-composer",
      "src/components/composer/types",
    ]);
  });

  it("never hardcodes the default ladder days in the composer (D-41)", () => {
    const LADDER_LITERAL = /\b3\s*,\s*10\s*,\s*20\b|\{3,10,20\}/;
    const offenders = files
      .filter(({ file }) => inComposer(file) || inComposerServer(file))
      .filter(({ text }) => LADDER_LITERAL.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
