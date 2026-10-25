import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isTenantPath } from "../src/components/shell/nav";

// A3: "Tenant screens have no navigation at all." The landlord shell (src/components/shell)
// is mounted only by src/app/(landlord)/layout.tsx. These tests make that structural: no
// tenant file and no root-level file may reach the shell, and the shell refuses to render
// on any D-03 tenant path.

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const IMPORT = /from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

function shellImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const hits: string[] = [];
  for (const match of source.matchAll(IMPORT)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    const resolved = specifier.startsWith("@/")
      ? path.join(src, specifier.slice(2))
      : specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : specifier;
    if (resolved.includes(path.join("components", "shell"))) hits.push(specifier);
  }
  return hits;
}

describe("A3 · tenant screens carry no shell", () => {
  it("nothing under src/app/(tenant) or src/server/tenant imports src/components/shell", () => {
    const files = [
      ...walk(path.join(src, "app", "(tenant)")),
      ...walk(path.join(src, "server", "tenant")),
    ];
    expect(files.length).toBeGreaterThan(0);
    const offenders = files
      .map((file) => [path.relative(root, file), shellImports(file)] as const)
      .filter(([, hits]) => hits.length > 0);
    expect(offenders).toEqual([]);
  });

  it("the root layout mounts no shell, so the tenant group cannot inherit one", () => {
    expect(shellImports(path.join(src, "app", "layout.tsx"))).toEqual([]);
    const tenantLayout = readFileSync(path.join(src, "app", "(tenant)", "layout.tsx"), "utf8");
    expect(tenantLayout).not.toMatch(/<(nav|Sidebar|BottomBar|PageHeader|DetailPanelHost)\b/);
  });

  it("recognises every D-03 tenant route as a tenant path", () => {
    for (const p of [
      "/u/abc123",
      "/u/abc123/reports",
      "/u/abc123/unit",
      "/u/abc123/receipts",
      "/u/abc123/receipts/R-0001/print",
      "/u/abc123/reported/42",
    ]) {
      expect(isTenantPath(p), p).toBe(true);
    }
    for (const p of ["/", "/landlord", "/units", "/units/7", "/upload", "/print/receipt/9"]) {
      expect(isTenantPath(p), p).toBe(false);
    }
  });
});
