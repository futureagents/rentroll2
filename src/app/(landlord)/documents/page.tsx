import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/coming-soon";

// L-14 · Documents — placeholder until the L-14 lane lands.
export const metadata: Metadata = { title: "Documents · RentRoll" };

export default function DocumentsPage() {
  return <ComingSoon title="Documents" screen="L-14" />;
}
