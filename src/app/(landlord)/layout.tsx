import type { ReactNode } from "react";

import { BottomBar } from "@/components/shell/bottom-bar";
import { DetailPanelHost } from "@/components/shell/detail-panel-host";
import { Sidebar } from "@/components/shell/sidebar";
import { createSupabaseServerClient } from "@/server/supabase/server";

// Landlord app shell (A3 global navigation, A4 responsive rules).
// Over 1024px: 220px sidebar, detail panels alongside content. 640–1024px: icon sidebar.
// Under 640px: bottom bar. Landlord route group: may use src/server/landlord and
// src/server/supabase. The (tenant) group has its own layout and never mounts this shell.

// Email for the account menu (D-39). Claims are verified locally; no network round trip
// per navigation. Any failure (no session, no env) just leaves the menu unlabelled.
async function signedInEmail(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const email = data?.claims?.email;
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
}

export default async function LandlordLayout({ children }: { children: ReactNode }) {
  const email = await signedInEmail();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Sidebar email={email} />
      <main className="flex min-w-0 flex-1 flex-col pb-16 sm:pb-0 sm:pl-16 lg:pl-[220px]">
        <DetailPanelHost>{children}</DetailPanelHost>
      </main>
      <BottomBar email={email} />
    </div>
  );
}
