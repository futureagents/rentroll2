import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/coming-soon";

// L-12 · Agreements — placeholder until the L-12 lane lands.
export const metadata: Metadata = { title: "Agreements · RentRoll" };

export default function AgreementsPage() {
  return <ComingSoon title="Agreements" screen="L-12" />;
}
