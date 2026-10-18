import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkBoundaries } from "../scripts/check-boundaries.mjs";

const projectRoot = path.resolve(__dirname, "..");

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), "rentroll-boundaries-"));
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(root, relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const fixtures: string[] = [];
afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function violationsFor(files: Record<string, string>) {
  const root = fixture(files);
  fixtures.push(root);
  return checkBoundaries(root);
}

describe("checkBoundaries", () => {
  it("passes on this repository", () => {
    expect(checkBoundaries(projectRoot)).toEqual([]);
  });

  it("flags 'use client' files importing server-only modules", () => {
    const violations = violationsFor({
      "src/server/env.ts": 'import "server-only";\nexport const x = 1;\n',
      "src/components/Bad.tsx": '"use client";\nimport { x } from "../server/env";\n',
      "src/components/AlsoBad.tsx": '"use client";\nimport "server-only";\n',
    });
    expect(violations.map((v) => v.file).sort()).toEqual([
      "src/components/AlsoBad.tsx",
      "src/components/Bad.tsx",
    ]);
  });

  it("flags src/lib importing src/server", () => {
    const violations = violationsFor({
      "src/lib/bad.ts": 'export { x } from "@/server/env";\n',
    });
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toMatch(/client code/);
  });

  it("flags tenant routes importing landlord code, but allows tenant server code", () => {
    const violations = violationsFor({
      "src/app/(tenant)/u/[token]/page.tsx":
        'import "@/server/landlord";\nimport "@/server/tenant";\nimport { L } from "../../../(landlord)/layout";\n',
    });
    expect(violations.map((v) => v.specifier).sort()).toEqual([
      "../../../(landlord)/layout",
      "@/server/landlord",
    ]);
  });

  it("flags cross-imports from landlord routes into tenant routes", () => {
    const violations = violationsFor({
      "src/app/(landlord)/page.tsx": 'import "@/app/(tenant)/layout";\n',
    });
    expect(violations).toHaveLength(1);
  });

  it("flags src/server/tenant importing src/server/landlord", () => {
    const violations = violationsFor({
      "src/server/tenant/index.ts": 'import "server-only";\nimport "../landlord";\n',
    });
    expect(violations).toHaveLength(1);
    expect(violations[0].specifier).toBe("../landlord");
  });

  it("ignores server components importing server code", () => {
    const violations = violationsFor({
      "src/app/(landlord)/page.tsx": 'import "@/server/landlord";\nimport "@/server/supabase/admin";\n',
      "src/app/(tenant)/u/[token]/page.tsx": 'import "@/server/supabase/server";\n',
    });
    expect(violations).toEqual([]);
  });
});
