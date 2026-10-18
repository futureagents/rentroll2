import type { ReactNode } from "react";

// Tenant route group. Structurally separate from (landlord): nothing in here
// may import src/app/(landlord) or src/server/landlord (enforced by
// scripts/check-boundaries.mjs).
export default function TenantLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
