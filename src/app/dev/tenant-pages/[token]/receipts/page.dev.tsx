// Development-only: renders the real MyReceiptsScreen for a real token at /dev/tenant-pages/:token/receipts, exactly
// as the /u/:token/receipts route will (never built: see next.config.ts). Lets P6.3 be checked against
// seeded data before the resolver lane wires the route.
import { MyReceiptsScreen } from "@/app/(tenant)/_screens";
import { InvalidLink } from "@/app/(tenant)/u/_components/invalid-link";
import { loadMyReceipts } from "@/server/tenant";

export default async function DevReceiptsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadMyReceipts(token);
  if (!view) return <InvalidLink />;
  return <MyReceiptsScreen basePath={`/dev/tenant-pages/${token}`} view={view} />;
}
