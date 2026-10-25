import type { ReactNode } from "react";

// Tenant route group. A3: "Tenant screens have no navigation at all — no sidebar, no menu,
// no links to anything except the tenant's own three pages" (D-03). This layout renders
// children only; the only links a tenant sees are the ones each T-nn page carries.
//
// This is structural, not a convention:
//  - the shell (Sidebar, BottomBar, DetailPanelHost) is mounted by src/app/(landlord)/layout.tsx
//    alone; the root layout mounts nothing, so there is nothing here to inherit;
//  - nothing under src/app/(tenant) may import src/components/shell (tests/shell-boundary.test.ts);
//  - the shell components themselves return null on any /u/… path (isTenantPath in nav.ts).
// Nothing in here may import src/app/(landlord) or src/server/landlord either
// (scripts/check-boundaries.mjs).
export default function TenantLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
