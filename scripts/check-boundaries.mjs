// Import-boundary check. Fails (exit 1) when:
//   1. client code imports a server-only module
//      (client code = any file starting with "use client", or anything under src/lib)
//   2. the tenant route group imports private landlord code
//      (src/server/landlord or src/app/(landlord))
//   3. the landlord route group imports the tenant route group
//   4. src/server/tenant imports src/server/landlord
//   5. tenant code (the tenant route group or src/server/tenant) imports src/server/composer,
//      which holds the S-01 message writer and assistant (G-1, D-37)
//
// Usage: node scripts/check-boundaries.mjs [rootDir]

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|(?:import|require)\(\s*["']([^"']+)["']\s*\)/g;
const USE_CLIENT_PATTERN = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function isInside(file, dir) {
  const relative = path.relative(dir, file);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveSpecifier(specifier, fromFile, srcDir) {
  if (specifier.startsWith("@/")) return path.join(srcDir, specifier.slice(2));
  if (specifier.startsWith(".")) return path.resolve(path.dirname(fromFile), specifier);
  return null; // bare package import
}

/**
 * @param {string} rootDir project root containing src/
 * @returns {{ file: string, specifier: string, rule: string }[]}
 */
export function checkBoundaries(rootDir) {
  const srcDir = path.join(rootDir, "src");
  const dirs = {
    server: path.join(srcDir, "server"),
    serverLandlord: path.join(srcDir, "server", "landlord"),
    serverTenant: path.join(srcDir, "server", "tenant"),
    serverComposer: path.join(srcDir, "server", "composer"),
    lib: path.join(srcDir, "lib"),
    landlordApp: path.join(srcDir, "app", "(landlord)"),
    tenantApp: path.join(srcDir, "app", "(tenant)"),
  };

  const violations = [];

  for (const file of walk(srcDir)) {
    const source = readFileSync(file, "utf8");
    const isClient = USE_CLIENT_PATTERN.test(source) || isInside(file, dirs.lib);
    const isTenantApp = isInside(file, dirs.tenantApp);
    const isLandlordApp = isInside(file, dirs.landlordApp);
    const isServerTenant = isInside(file, dirs.serverTenant);

    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2];
      const target = resolveSpecifier(specifier, file, srcDir);
      const report = (rule) =>
        violations.push({ file: path.relative(rootDir, file), specifier, rule });

      if (isClient && (specifier === "server-only" || (target && isInside(target, dirs.server)))) {
        report("client code must not import server-only modules");
      }
      if (!target) continue;

      if (isTenantApp && (isInside(target, dirs.serverLandlord) || isInside(target, dirs.landlordApp))) {
        report("tenant routes must not import landlord code");
      }
      if (isLandlordApp && isInside(target, dirs.tenantApp)) {
        report("landlord routes must not import tenant routes");
      }
      if (isServerTenant && isInside(target, dirs.serverLandlord)) {
        report("src/server/tenant must not import src/server/landlord");
      }
      if ((isTenantApp || isServerTenant) && isInside(target, dirs.serverComposer)) {
        report("tenant code must not import src/server/composer");
      }
    }
  }

  return violations;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rootDir = path.resolve(process.argv[2] ?? ".");
  const violations = checkBoundaries(rootDir);
  if (violations.length > 0) {
    console.error("Boundary violations:");
    for (const { file, specifier, rule } of violations) {
      console.error(`  ${file}: imports "${specifier}" (${rule})`);
    }
    process.exit(1);
  }
  console.log("Boundary check passed.");
}
