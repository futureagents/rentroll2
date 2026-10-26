import type { Metadata } from "next";

import { requireLandlord } from "@/server/auth/session";

import { MaintenanceBoard } from "./_components/board";
import { loadBoard } from "./_server/queries";

// L-06 · Maintenance board (`/maintenance`). "See every reported problem, in order of urgency,
// and move it along."
export const metadata: Metadata = { title: "Maintenance · RentRoll" };

export default async function MaintenancePage() {
  const landlord = await requireLandlord("/maintenance");
  const data = await loadBoard(landlord.landlordId);
  return <MaintenanceBoard data={data} now={new Date().toISOString()} />;
}
