// D-56: the landlord's uploaded signature prints only on landlord-printed receipts and statements,
// never on the tenant's copy. D-30 does not change: `signature_document_id` is not tenant-readable,
// src/server/tenant never selects it, and tenant code never reaches the settings module that signs
// its URL. A tenant page that could render the image would hand out a clean copy of the signature.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SELECT, TENANT_COLUMNS } from "../../src/server/tenant/columns";

const root = path.resolve(__dirname, "../..");
const TENANT_DIRS = ["src/server/tenant", "src/app/(tenant)"];

function sources(dir: string): { file: string; text: string }[] {
  const full = path.join(root, dir);
  return readdirSync(full, { recursive: true, encoding: "utf8" })
    .filter((entry) => /\.(ts|tsx)$/.test(entry))
    .map((entry) => ({ file: path.join(dir, entry), text: readFileSync(path.join(full, entry), "utf8") }));
}

describe("D-56: the signature is never tenant-readable", () => {
  it("the D-30 tenant column list does not contain signature_document_id", () => {
    for (const [table, columns] of Object.entries(TENANT_COLUMNS)) {
      expect(columns, `${table}`).not.toContain("signature_document_id");
    }
    expect(TENANT_COLUMNS.landlord).toEqual(["name", "receipt_name", "phone", "logo_document_id"]);
  });

  it("no tenant select string names a signature", () => {
    for (const [name, select] of Object.entries(SELECT)) {
      expect(select, name).not.toMatch(/signature/i);
    }
  });

  it("tenant code never names the signature or imports the settings module that signs it", () => {
    const files = TENANT_DIRS.flatMap(sources);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files
      .filter(({ text }) => /signature/i.test(text) || /server\/settings/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
