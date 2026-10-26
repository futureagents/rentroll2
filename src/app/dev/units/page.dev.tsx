// Development-only preview of L-08…L-11 from fixtures, at /dev/units?screen=l08|l09|l10|l11.
// Renders the client screens with props; nothing is read from or written to the database until a
// button that calls a server action is pressed.
import { UnitRegister } from "@/app/(landlord)/units/units-register";
import { UnitDetail } from "@/app/(landlord)/units/[unitId]/unit-detail";
import { TenantList } from "@/app/(landlord)/tenants/tenant-list";
import { TenantDetail } from "@/app/(landlord)/tenants/[tenantId]/tenant-detail";

import { tenantList, tenantView, unitRegister, unitView } from "./fixtures";

export default async function UnitsDevPage({ searchParams }: { searchParams: Promise<{ screen?: string; vacant?: string }> }) {
  const { screen = "l08", vacant } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col">
      {screen === "l08" && <UnitRegister {...unitRegister} initialQuery="" initialAdd="none" />}
      {screen === "l09" && <UnitDetail view={vacant ? { ...unitView, current: null, occupancy: "vacant" } : unitView} />}
      {screen === "l10" && <TenantList tenants={tenantList} initialStanding="current" initialQuery="" />}
      {screen === "l11" && <TenantDetail view={tenantView} />}
    </div>
  );
}
