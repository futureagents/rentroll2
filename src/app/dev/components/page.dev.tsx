// Development-only. The `.dev.tsx` suffix means this file is a route under
// `next dev` and ignored by `next build` (see pageExtensions in next.config.ts).
export default function DevComponentsPage() {
  return <main className="p-8">Dev components</main>;
}
