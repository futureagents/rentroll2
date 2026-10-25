import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/coming-soon";

// L-08 · Units — placeholder until the L-08 lane lands.
export const metadata: Metadata = { title: "Units · RentRoll" };

export default function UnitsPage() {
  return <ComingSoon title="Units" screen="L-08" />;
}
