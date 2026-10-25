// A1 · Design tokens are declared once in src/app/globals.css with the values in
// spec/foundations.md, and nowhere else: no hex literal and no stock Tailwind palette class
// in any component, screen or stylesheet (CLAUDE.md §3, lane brief P1.2).
import { readdirSync, readFileSync, statSync } from "node:fs";
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

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry))) files.push(full);
  }
  return files;
}

function specColourTokens(): Record<string, string> {
  const spec = readFileSync(path.join(root, "spec", "foundations.md"), "utf8");
  const tokens: Record<string, string> = {};
  for (const match of spec.matchAll(/^\| `([a-z-]+)` \| `(#[0-9A-Fa-f]{6})` \|/gm)) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

function declaredColourTokens(): Record<string, string> {
  const css = readFileSync(tokensFile, "utf8");
  const tokens: Record<string, string> = {};
  for (const match of css.matchAll(/--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

describe("A1 design tokens", () => {
  it("declares every A1 colour once in globals.css with the spec's value", () => {
    const spec = specColourTokens();
    expect(Object.keys(spec).sort()).toEqual(
      ["body", "canvas", "danger", "ink", "line", "muted", "neutral", "primary", "primary-soft", "success", "surface", "warning"],
    );
    expect(declaredColourTokens()).toEqual(spec);
  });

  it("removes the stock Tailwind palette so only A1 colours exist", () => {
    expect(readFileSync(tokensFile, "utf8")).toMatch(/--color-\*:\s*initial;/);
  });

  it("has no hex colour literal outside globals.css", () => {
    const offenders = walk(src)
      .filter((file) => file !== tokensFile)
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return [...source.matchAll(HEX_LITERAL)].map((m) => `${path.relative(root, file)}: ${m[0]}`);
      });
    expect(offenders).toEqual([]);
  });

  it("uses no stock Tailwind palette class", () => {
    const offenders = walk(src).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(STOCK_PALETTE)].map((m) => `${path.relative(root, file)}: ${m[0]}`);
    });
    expect(offenders).toEqual([]);
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
