import type { Metadata } from "next";

import { requireLandlord } from "@/server/auth/session";

import { MaintenanceBoard } from "../_components/board";
import type { PanelIntent } from "../_components/request-panel";
import { loadBoard, loadRequest } from "../_server/queries";

// L-07 · Request detail panel (`/maintenance/:requestId`), opened over the L-06 board.
// `?close=1` arrives from a drag to Done (D-22); `?compose=tenant_update` from the L-06 toast (D-36).
export const metadata: Metadata = { title: "Maintenance · RentRoll" };

export default async function RequestPage(props: PageProps<"/maintenance/[requestId]">) {
  const { requestId } = await props.params;
  const search = await props.searchParams;
  const landlord = await requireLandlord(`/maintenance/${requestId}`);
  const [data, detail] = await Promise.all([
    loadBoard(landlord.landlordId),
    loadRequest(landlord.landlordId, requestId),
  ]);
  const intent: PanelIntent =
    search.close === "1" ? "close" : search.compose === "tenant_update" ? "tenant_update" : undefined;
  return <MaintenanceBoard data={data} now={new Date().toISOString()} detail={detail} intent={intent} />;
}
