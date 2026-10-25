import type { Metadata } from "next";
import type { ReactNode } from "react";

// Print views (P-01…P-03). No shell, no navigation: the page is the printable document.
// Receipts and door cards are not for search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
