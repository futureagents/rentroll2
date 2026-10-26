// G-1 · S-01 is the only send path in the product. These checks make it structural: another
// module cannot hand a pre-filled message to WhatsApp, mail or SMS, cannot write the `message`
// table, and cannot reach the composer's server functions, hand-off or writer. The single
// exception is `recordCall` from src/server/composer/record.ts (L05-FRM-LOGCALL, D-17 kind
// `call`), imported by name in a server file: it records a call that already happened and cannot
// send anything.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface SourceFile {
  file: string;
  text: string;
}

const RECORD = "src/server/composer/record";
const HANDOFF = "src/components/composer/handoff";
const ACTIONS = "src/components/composer/actions";

const inComposer = (file: string) => file.startsWith("src/components/composer/");
const inComposerServer = (file: string) => file.startsWith("src/server/composer/");
const USE_CLIENT = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/;

interface ImportStatement {
  /** "import", "export" (re-export), "dynamic" (import()/require()) or "bare" (import "x"). */
  form: "import" | "export" | "dynamic" | "bare";
  /** Everything between the keyword and `from`, e.g. `{ recordCall }`, `type { X }`, `* as r`. */
  clause: string;
  /** src-relative target without extension, or the bare package name. */
  target: string;
}

function resolve(file: string, specifier: string): string {
  const resolved = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
      : specifier;
  return resolved.replace(/\.(ts|tsx|js|jsx|mjs)$/, "").replace(/\/index$/, "");
}

function importsOf({ file, text }: SourceFile): ImportStatement[] {
  const statements: ImportStatement[] = [];
  for (const m of text.matchAll(/\b(import|export)\s+([^;"'`]*?)\s*from\s*["']([^"']+)["']/g)) {
    statements.push({ form: m[1] as "import" | "export", clause: m[2].trim(), target: resolve(file, m[3]) });
  }
  for (const m of text.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    statements.push({ form: "dynamic", clause: "", target: resolve(file, m[1]) });
  }
  for (const m of text.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    statements.push({ form: "bare", clause: "", target: resolve(file, m[1]) });
  }
  return statements;
}

/** The one import of composer code allowed outside the composer: `import { recordCall } from …record`. */
const RECORD_CALL_ONLY = /^\{\s*recordCall(?:\s+as\s+[A-Za-z_$][\w$]*)?\s*,?\s*\}$/;

export function sendPathViolations(files: SourceFile[]): string[] {
  const violations: string[] = [];
  const report = (file: string, rule: string) => violations.push(`${file}: ${rule}`);

  const PREFILL = [
    /wa\.me\/[^"'`\s]*\?[^"'`\s]*text=/,
    /api\.whatsapp\.com\/send/,
    /whatsapp:\/\/send/,
    /mailto:[^"'`\s]*[?&]body=/,
    /sms:[^"'`\s]*[?&]body=/,
  ];
  const MESSAGE_WRITE = /from\(\s*["'`]message["'`]\s*\)[\s\S]{0,400}?\.(?:insert|upsert|update|delete)\s*\(/;
  const PROVIDER =
    /graph\.facebook\.com|api\.twilio\.com|api\.sendgrid\.com|api\.resend\.com|from\s+["'](?:twilio|nodemailer|resend|@sendgrid\/mail)["']/;

  for (const source of files) {
    const { file, text } = source;
    const composer = inComposer(file) || inComposerServer(file);

    if (!inComposer(file)) {
      const prefilled =
        PREFILL.some((pattern) => pattern.test(text)) ||
        (/wa\.me|whatsapp/i.test(text) && /[?&]text=|\btext\s*:/.test(text) && /encodeURIComponent|URLSearchParams/.test(text));
      if (prefilled) report(file, "builds a pre-filled hand-off outside the composer");
    }
    if (MESSAGE_WRITE.test(text) && file !== `${RECORD}.ts`) report(file, "writes the message table");
    if (PROVIDER.test(text)) report(file, "calls a messaging provider");

    for (const statement of importsOf(source)) {
      const { target, form, clause } = statement;

      if (target === HANDOFF && file !== "src/components/composer/message-composer.tsx") {
        report(file, "imports the hand-off");
      }
      if (target === RECORD && composer && file !== `${ACTIONS}.ts`) {
        report(file, "imports the message writer inside the composer outside actions.ts");
      }

      if (composer) continue;
      const privateTarget =
        target === ACTIONS || target === HANDOFF || target === "src/server/composer" || target.startsWith("src/server/composer/");
      if (!privateTarget) continue;

      const allowedRecordCall =
        target === RECORD && form === "import" && RECORD_CALL_ONLY.test(clause) && !USE_CLIENT.test(text);
      if (!allowedRecordCall) report(file, `imports ${target} (${form} ${clause || "…"})`);
    }
  }
  return violations;
}

const root = path.resolve(__dirname, "..", "..");
const src = path.join(root, "src");
const files: SourceFile[] = readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter((entry) => /\.(ts|tsx|js|jsx|mjs)$/.test(entry))
  .map((entry) => ({
    file: path.join("src", entry).split(path.sep).join("/"),
    text: readFileSync(path.join(src, entry), "utf8"),
  }));

describe("G-1 single send path — this repository", () => {
  it("finds the source tree", () => {
    expect(files.some(({ file }) => file === `${HANDOFF}.ts`)).toBe(true);
    expect(files.some(({ file }) => file === `${RECORD}.ts`)).toBe(true);
  });

  it("has no violations", () => {
    expect(sendPathViolations(files)).toEqual([]);
  });

  it("calls the message writer from the composer only through actions.ts", () => {
    const importers = files
      .filter((source) => importsOf(source).some(({ target }) => target === RECORD))
      .map(({ file }) => file);
    expect(importers.filter((file) => inComposer(file) || inComposerServer(file))).toEqual([`${ACTIONS}.ts`]);
  });

  it("exports neither server functions nor the hand-off from the composer barrel", () => {
    const barrel = files.find(({ file }) => file === "src/components/composer/index.ts")!;
    expect(importsOf(barrel).map(({ target }) => target)).toEqual([
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

describe("G-1 single send path — the recordCall exception, and nothing more", () => {
  const rentAction = "src/app/(landlord)/rent/actions.ts";
  const check = (text: string, file = rentAction) => sendPathViolations([{ file, text }]);

  it("allows another lane's server file to import recordCall by name", () => {
    expect(check(`"use server";\nimport { recordCall } from "@/server/composer/record";\n`)).toEqual([]);
    expect(check(`import { recordCall as logCall } from "../../../server/composer/record";\n`, "src/server/landlord/rent/calls.ts")).toEqual([]);
  });

  it("rejects every other import of the writer", () => {
    const forbidden = [
      `import { recordConfirmedSend } from "@/server/composer/record";`,
      `import { recordCall, recordConfirmedSend } from "@/server/composer/record";`,
      `import * as record from "@/server/composer/record";`,
      `import record from "@/server/composer/record";`,
      `import type { recordCall } from "@/server/composer/record";`,
      `export { recordCall } from "@/server/composer/record";`,
      `const r = await import("@/server/composer/record");`,
    ];
    for (const line of forbidden) expect(check(line), line).not.toEqual([]);
  });

  it("rejects recordCall in client code", () => {
    expect(check(`"use client";\nimport { recordCall } from "@/server/composer/record";\n`, "src/app/(landlord)/rent/form.tsx")).not.toEqual([]);
  });

  it("rejects every other composer module", () => {
    for (const target of ["@/server/composer/load", "@/server/composer/assistant", "@/server/composer/india-date", "@/components/composer/actions", "@/components/composer/handoff"]) {
      expect(check(`import { x } from "${target}";`), target).not.toEqual([]);
    }
  });

  it("still rejects writing the message table and building hand-off links", () => {
    expect(check(`await supabase.from("message").insert({ kind: "call" });`)).not.toEqual([]);
    expect(check("const url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;")).not.toEqual([]);
    expect(check("const url = `mailto:${to}?subject=x&body=${encodeURIComponent(body)}`;")).not.toEqual([]);
  });

  it("allows the public composer barrel to openers", () => {
    expect(check(`import { MessageComposer } from "@/components/composer";`, "src/app/(landlord)/rent/board.tsx")).toEqual([]);
  });
});
