import type { Metadata } from "next";

import { requireLandlord } from "@/server/auth/session";
import { listTenancies } from "@/server/landlord/units/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { parseStanding } from "../units/_lib/occupancy";
import { parseQuery } from "../units/_lib/text-filter";
import { TenantList } from "./tenant-list";

// L-10 · Tenant list (spec/screens/L-10.md). A "tenant" is a tenancy (D-07). `?status=` picks the
// segment (current by default), `?q=` pre-fills the filter box.
export const metadata: Metadata = { title: "Tenants · RentRoll" };

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireLandlord("/tenants");
  const params = await searchParams;
  const db = await createSupabaseServerClient();
  const tenancies = await listTenancies(db);

  return (
    <TenantList
      tenants={tenancies.map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
        unitNumber: t.unitNumber,
        propertyName: t.propertyName,
        status: t.status,
        noticeVacateOn: t.noticeVacateOn,
        agreementEndsOn: t.agreementEndsOn,
      }))}
      initialStanding={parseStanding(params.status)}
      initialQuery={parseQuery(params.q)}
    />
  );
}
