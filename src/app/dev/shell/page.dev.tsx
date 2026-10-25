// Development-only (`.dev.tsx`, see next.config.ts): the A3/A4 shell exercised end to end
// at /dev/shell — page header, stat grid, data table and a detail panel that opens
// alongside over 1024px and over the page below. Wraps the real landlord layout.
import LandlordLayout from "@/app/(landlord)/layout";

import { ShellDemo } from "./demo";

export default function DevShellPage() {
  return (
    <LandlordLayout>
      <ShellDemo />
    </LandlordLayout>
  );
}
