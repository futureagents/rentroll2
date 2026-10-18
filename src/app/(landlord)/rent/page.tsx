import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/coming-soon";

// L-04 · Rent — placeholder until the L-04 lane lands.
export const metadata: Metadata = { title: "Rent · RentRoll" };

export default function RentPage() {
  return <ComingSoon title="Rent" screen="L-04" />;
}
