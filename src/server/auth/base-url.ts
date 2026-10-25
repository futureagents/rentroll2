import "server-only";

import { headers } from "next/headers";

/**
 * Absolute base URL of this deployment, for links in auth emails (the reset link's redirect).
 * `APP_BASE_URL` (D-03, .env.example) when set, otherwise the request's own origin.
 */
export async function appBaseUrl(): Promise<string> {
  const configured = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
