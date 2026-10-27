// Development-only: renders the real MyUnitScreen for a real token at /dev/tenant-pages/:token/unit, exactly
// as the /u/:token/unit route will (never built: see next.config.ts). Lets P6.3 be checked against
// seeded data before the resolver lane wires the route.
import { MyUnitScreen } from "@/app/(tenant)/_screens";
import { InvalidLink } from "@/app/(tenant)/u/_components/invalid-link";
import { loadMyUnit } from "@/server/tenant";

export default async function DevUnitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadMyUnit(token);
  if (!view) return <InvalidLink />;
  return <MyUnitScreen basePath={`/dev/tenant-pages/${token}`} view={view} />;
}
