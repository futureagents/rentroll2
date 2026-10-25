import type { ReactNode } from "react";

import { BottomBar } from "@/components/shell/bottom-bar";
import { Sidebar } from "@/components/shell/sidebar";

// Landlord app shell (A3 global navigation, A4 responsive rules).
// Over 1024px: 220px sidebar. 640–1024px: icon sidebar. Under 640px: bottom bar.
// Landlord route group. May use src/server/landlord and src/server/supabase.
export default function LandlordLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Sidebar />
      <main className="flex flex-1 flex-col pb-16 sm:pb-0 sm:pl-16 lg:pl-[220px]">{children}</main>
      <BottomBar />
    </div>
  );
}
