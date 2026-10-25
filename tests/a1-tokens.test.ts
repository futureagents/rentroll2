// A1 · Design tokens are declared once in src/app/globals.css with the values in
// spec/foundations.md, and nowhere else: no hex literal and no stock Tailwind palette class
// in any component, screen or stylesheet (CLAUDE.md §3, lane brief P1.2).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const tokensFile = path.join(src, "app", "globals.css");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
/** #abc, #abcd, #aabbcc, #aabbccdd — not followed by more word characters (so "#add-unit" is a fragment, not a colour). */
const HEX_LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])/gi;
const STOCK_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|shadow|accent|caret|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

const tokensCss = readFileSync(tokensFile, "utf8");
const sources = readdirSync(src, { recursive: true, encoding: "utf8" })
  .map((entry) => path.join(src, entry))
  .filter((file) => SOURCE_EXTENSIONS.has(path.extname(file)))
  .map((file) => ({ file: path.relative(root, file), text: readFileSync(file, "utf8") }));

/** "file: match" for every hit of `pattern` in `files`. */
function offenders(pattern: RegExp, files = sources): string[] {
  return files.flatMap(({ file, text }) => [...text.matchAll(pattern)].map((m) => `${file}: ${m[0]}`));
}

function colourTokens(text: string, pattern: RegExp): Record<string, string> {
  return Object.fromEntries([...text.matchAll(pattern)].map((m) => [m[1], m[2].toLowerCase()]));
}

describe("A1 design tokens", () => {
  it("declares every A1 colour once in globals.css with the spec's value", () => {
    const spec = colourTokens(
      readFileSync(path.join(root, "spec", "foundations.md"), "utf8"),
      /^\| `([a-z-]+)` \| `(#[0-9A-Fa-f]{6})` \|/gm,
    );
    expect(Object.keys(spec)).toHaveLength(12);
    expect(colourTokens(tokensCss, /--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)).toEqual(spec);
  });

  it("removes the stock Tailwind palette so only A1 colours exist", () => {
    expect(tokensCss).toMatch(/--color-\*:\s*initial;/);
  });

  it("has no hex colour literal outside globals.css", () => {
    const outsideTokens = sources.filter(({ file }) => path.join(root, file) !== tokensFile);
    expect(outsideTokens.length).toBe(sources.length - 1);
    expect(offenders(HEX_LITERAL, outsideTokens)).toEqual([]);
  });

  it("uses no stock Tailwind palette class", () => {
    expect(offenders(STOCK_PALETTE)).toEqual([]);
  });

  it("catches a hex literal when one appears", () => {
    expect('className="bg-[#1b3a5c]"'.match(HEX_LITERAL)).toEqual(["#1b3a5c"]);
    expect("fill='#FFF'".match(HEX_LITERAL)).toEqual(["#FFF"]);
    expect('href="/dev/components#add-unit"'.match(HEX_LITERAL)).toBeNull();
    expect('href="#stat-cards"'.match(HEX_LITERAL)).toBeNull();
    expect("text-gray-700 bg-blue-500".match(STOCK_PALETTE)).toEqual(["text-gray-700", "bg-blue-500"]);
    expect("bg-primary-soft text-neutral".match(STOCK_PALETTE)).toBeNull();
  });
});
