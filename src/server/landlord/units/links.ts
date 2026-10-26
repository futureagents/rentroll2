import "server-only";

import { headers } from "next/headers";

// The origin for links that carry a token: the tenant link L-09 copies and shares, and the door
// code L-09 shows and P-03 prints (D-01). A printed sticker outlives any preview or alternate
// domain, so these links come only from the configured APP_BASE_URL (D-03, .env.example), never
// from the request's Host header (P-03 base-URL OPEN; proposed decision in the lane PR). In local
// development, with no APP_BASE_URL set, the request origin is used so the screens still work.
// Returns null when no safe origin exists; screens then show why the link is missing.
export async function tokenLinkBase(): Promise<string | null> {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "development") return null;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"}://${host}`;
}

/** The text a screen shows instead of a token link when no base URL is configured. */
export const NO_BASE_URL = "Links are unavailable until the app's address (APP_BASE_URL) is configured.";
