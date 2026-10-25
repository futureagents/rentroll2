import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/coming-soon";

// L-15 · Settings — placeholder until the L-15 lane lands.
export const metadata: Metadata = { title: "Settings · RentRoll" };

export default function SettingsPage() {
  return <ComingSoon title="Settings" screen="L-15" />;
}
