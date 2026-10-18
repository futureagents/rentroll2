import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/coming-soon";

// L-10 · Tenants — placeholder until the L-10 lane lands.
export const metadata: Metadata = { title: "Tenants · RentRoll" };

export default function TenantsPage() {
  return <ComingSoon title="Tenants" screen="L-10" />;
}
