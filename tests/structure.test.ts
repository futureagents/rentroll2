import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

const root = path.resolve(__dirname, "..");
const app = path.join(root, "src", "app");

describe("route structure", () => {
  it("keeps landlord and tenant route groups separate", () => {
    expect(existsSync(path.join(app, "(landlord)", "layout.tsx"))).toBe(true);
    expect(existsSync(path.join(app, "(tenant)", "layout.tsx"))).toBe(true);
    expect(existsSync(path.join(app, "(tenant)", "u", "[token]", "page.tsx"))).toBe(true);
    expect(readdirSync(path.join(app, "(landlord)"))).not.toContain("u");
  });

  it("only recognises *.dev.tsx routes in development", () => {
    // vitest runs with NODE_ENV=test, matching the production branch.
    expect(nextConfig.pageExtensions).not.toContain("dev.tsx");
    expect(existsSync(path.join(app, "dev", "components", "page.dev.tsx"))).toBe(true);
    expect(existsSync(path.join(app, "dev", "components", "page.tsx"))).toBe(false);
  });
});
