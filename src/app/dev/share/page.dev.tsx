// Development-only. The `.dev.tsx` suffix means this file is a route under `next dev` and ignored
// by `next build` (see pageExtensions in next.config.ts).
// S-03 demo at /dev/share: this browser's own mode, both modes side by side, a short and a very
// long link, the clipboard-blocked case (simulated, and for real in a frame that denies the
// clipboard). `?embed=blocked` is the page that frame loads.
//
// Links are built here the way screens must build them: on the server, from APP_BASE_URL only,
// never from the request's address. The tokens are fixtures and resolve to nothing.
import { ShareDemo } from "./share-demo";

const SHORT_TOKEN = "q7Xk2pLm9VbT4nRw8sYc3hJd6fGa1eZu5oMi0tNyKxB";

export default async function DevSharePage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const { embed } = await searchParams;
  const base = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "") || null;
  const links = base
    ? {
        short: `${base}/u/${SHORT_TOKEN}`,
        long: `${base}/u/${SHORT_TOKEN}/receipts/RR-0847/print?for=Flat%204C%2C%20Kulkarni%20Apartments%2C%20Baner%20Road%2C%20Pune&month=2026-10&copy=landlord-office-and-accountant-records`,
        door: `${base}/u/Dr9wK3mQ5xLp8TzV2cNb7hYj4gFs6aEu1oRi0tWnKeM`,
      }
    : null;
  return <ShareDemo links={links} embed={embed === "blocked"} />;
}
