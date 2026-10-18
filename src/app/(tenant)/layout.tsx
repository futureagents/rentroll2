import type { ReactNode } from "react";

// Tenant route group. A3: "Tenant screens have no navigation at all — no sidebar, no menu,
// no links to anything except the tenant's own three pages" (D-03). This layout therefore
// renders children only; the only links a tenant sees are the ones each T-nn page carries.
// Structurally separate from (landlord): nothing in here may import src/app/(landlord) or
// src/server/landlord (enforced by scripts/check-boundaries.mjs).
export default function TenantLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
