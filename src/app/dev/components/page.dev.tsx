// Development-only. The `.dev.tsx` suffix means this file is a route under
// `next dev` and ignored by `next build` (see pageExtensions in next.config.ts).
// A2 gallery: every component in src/components/ui in every state, at /dev/components.
import { Gallery } from "./gallery";

export default function DevComponentsPage() {
  return <Gallery />;
}
