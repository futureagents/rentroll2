import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/coming-soon";

// L-06 · Maintenance — placeholder until the L-06 lane lands.
export const metadata: Metadata = { title: "Maintenance · RentRoll" };

export default function MaintenancePage() {
  return <ComingSoon title="Maintenance" screen="L-06" />;
}
