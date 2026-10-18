import type { NextConfig } from "next";

// Development-only routes: any route file named `*.dev.tsx` (for example
// `src/app/dev/components/page.dev.tsx`) is only recognised while running
// `next dev`. `next build` runs with NODE_ENV=production, so those files are
// treated as plain colocated files and never become routes in the output.
const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  pageExtensions: isDevelopment ? ["dev.tsx", "tsx", "ts"] : ["tsx", "ts"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
