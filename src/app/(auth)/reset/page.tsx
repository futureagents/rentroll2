import type { Metadata } from "next";

import { ResetForm } from "./reset-form";

// L-01 · /reset (L01-LNK-RESET).
export const metadata: Metadata = { title: "Reset password · RentRoll" };

export default function ResetPage() {
  return <ResetForm />;
}
