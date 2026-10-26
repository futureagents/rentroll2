import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { compareUnits } from "@/lib/display/unit-label";
import { appBaseUrl } from "@/server/auth/base-url";
import { requireLandlord } from "@/server/auth/session";
import { doorCardUnits } from "@/server/landlord/units/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { DoorQrCards } from "./door-qr-cards";

// P-03 · Door QR cards, the signed-in route behind L08-BTN-PRINTQR and L09-BTN-QR's print option.
// `?units=<id>,<id>` prints those units in that order; no parameter prints every unit (the L-08
// "nothing selected, no filter" case). Unit ids only: the door tokens are read here, under RLS,
// and never travel in a URL (D-01). Another landlord's ids simply return no rows (E4-5).
export const metadata: Metadata = { title: "Door QR codes · RentRoll" };

export default async function DoorQrPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.units) ? params.units.join(",") : params.units;
  const ids = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 500) : null;
  await requireLandlord(raw ? `/print/door-qr?units=${encodeURIComponent(raw)}` : "/print/door-qr");

  const db = await createSupabaseServerClient();
  const { units, landlordPhone } = await doorCardUnits(db, ids);
  if (units.length === 0) notFound();

  const order = ids ? new Map(ids.map((id, i) => [id, i])) : null;
  const sorted = [...units].sort((a, b) => (order ? (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) : compareUnits(a, b)));

  return (
    <DoorQrCards
      baseUrl={await appBaseUrl()}
      landlordPhone={landlordPhone}
      units={sorted.map((u) => ({ unitNumber: u.unitNumber, propertyName: u.propertyName, doorToken: u.doorToken }))}
    />
  );
}
