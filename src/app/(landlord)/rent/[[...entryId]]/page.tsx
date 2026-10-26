import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireLandlord } from "@/server/auth/session";
import { loadRentBoard, loadRentEntry } from "@/server/landlord/rent/board";
import { missingRentRows } from "@/server/landlord/rent/generate";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { isMonthKey, kolkataToday, monthOf } from "../_lib/calendar";
import { parseRentFilter } from "../_lib/status";
import { RentScreen } from "../_components/rent-screen";

// L-04 Rent due board at `/rent`, and L-05 Rent detail panel at `/rent/:entryId` "opens as a panel
// over L-04". One optional catch-all page serves both, so opening and closing the panel keeps the
// board's client state (selection, open forms, the Undo toast) instead of remounting it.
export const metadata: Metadata = { title: "Rent · RentRoll" };

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function RentPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ entryId: segments }, query] = await Promise.all([params, searchParams]);
  if (segments && segments.length > 1) notFound();
  const entryId = segments?.[0] ?? null;

  await requireLandlord(entryId ? `/rent/${entryId}` : "/rent");
  const db = await createSupabaseServerClient();

  // D-24: the rent calendar is Asia/Kolkata. L04-SEL-MONTH: nothing beyond the current month.
  const today = kolkataToday(new Date());
  const currentMonth = monthOf(today);

  const detail = entryId ? await loadRentEntry(db, entryId) : null;
  if (entryId && !detail) notFound(); // E4-5: another landlord's entry is simply absent.

  const requested = one(query.month);
  const month =
    requested && isMonthKey(requested) && requested <= currentMonth ? requested : (detail?.month ?? currentMonth);

  const [board, missing] = await Promise.all([
    loadRentBoard(db, month),
    month === currentMonth ? missingRentRows(db, month) : Promise.resolve(0),
  ]);

  return (
    <RentScreen
      board={board}
      detail={detail}
      today={today}
      currentMonth={currentMonth}
      missingRows={missing}
      initialFilter={parseRentFilter(one(query.status))}
      initialProperty={one(query.property) ?? ""}
    />
  );
}
