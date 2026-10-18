import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/coming-soon";

// L-13 · Deposits — placeholder until the L-13 lane lands.
export const metadata: Metadata = { title: "Deposits · RentRoll" };

export default function DepositsPage() {
  return <ComingSoon title="Deposits" screen="L-13" />;
}
