// Development-only (`.dev.tsx`, ignored by `next build`). S-02 payment sheet at /dev/payment:
// iOS, Android and desktop modes; a saved UPI ID, none, and a long receipt name; loading, slow,
// failed; and "Your saved settings", which reads the signed-in landlord's real row.
import { PaymentPreview } from "./preview";

export default function DevPaymentPage() {
  return <PaymentPreview />;
}
