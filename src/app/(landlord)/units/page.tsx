import type { Metadata } from "next";

import { requireLandlord } from "@/server/auth/session";
import { listUnits } from "@/server/landlord/units/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { kolkataToday } from "./_lib/dates";
import { parseQuery } from "./_lib/text-filter";
import { UnitRegister } from "./units-register";

// L-08 · Unit register (spec/screens/L-08.md). `?q=` pre-fills the filter box (L03-CRD-OCCUPANCY
// routes to `/units?q=vacant`); `?add=property` opens the add form on "Add a property…" (D-39).
export const metadata: Metadata = { title: "Units · RentRoll" };

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireLandlord("/units");
  const params = await searchParams;
  const db = await createSupabaseServerClient();
  const { properties, units } = await listUnits(db, kolkataToday(new Date()));
  const add = Array.isArray(params.add) ? params.add[0] : params.add;

  return (
    <UnitRegister
      properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      units={units}
      initialQuery={parseQuery(params.q)}
      initialAdd={add === "property" ? "property" : add === "1" || add === "unit" ? "unit" : "none"}
    />
  );
}
