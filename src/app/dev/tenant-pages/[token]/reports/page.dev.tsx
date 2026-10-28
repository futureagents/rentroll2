// Development-only: renders the real MyReportsScreen for a real token at /dev/tenant-pages/:token/reports, exactly
// as the /u/:token/reports route will (never built: see next.config.ts). Lets P6.3 be checked against
// seeded data before the resolver lane wires the route.
import { MyReportsScreen } from "@/app/(tenant)/_screens";
import { InvalidLink } from "@/app/(tenant)/u/_components/invalid-link";
import { loadMyReports } from "@/server/tenant";

export default async function DevReportsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadMyReports(token);
  if (!view) return <InvalidLink />;
  return <MyReportsScreen basePath={`/dev/tenant-pages/${token}`} view={view} />;
}
