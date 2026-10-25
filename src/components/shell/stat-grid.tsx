import type { ReactNode } from "react";

// A4: "Under 640px … stat cards go two per row." L-03: "four stat cards in a row" above
// that. Screens put their A2 stat cards inside this grid instead of choosing columns.
//
// PROMOTE: stat grid — the responsive container for A2 Stat cards; should sit beside
// StatCard in src/components/ui.
export function StatGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4 ${className}`}>{children}</div>;
}
