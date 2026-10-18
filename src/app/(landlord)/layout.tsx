import type { ReactNode } from "react";

// Landlord route group. May use src/server/landlord and src/server/supabase.
export default function LandlordLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
