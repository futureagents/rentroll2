"use server";

import { refresh } from "next/cache";

import { requireLandlord } from "@/server/auth/session";
import { generateRentRows } from "@/server/landlord/rent/generate";
import {
  editAmountDue,
  logCall,
  recordFullBalances,
  recordPayments,
  voidPayments,
  type Result,
} from "@/server/landlord/rent/mutations";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { kolkataToday, monthOf } from "./_lib/calendar";

// L-04 and L-05 server actions. Each one re-checks the session (server actions are reachable by
// direct POST) and runs on the landlord's RLS-scoped client, never the service role. Dates are
// "today in Asia/Kolkata" (D-24), never the server's clock zone.

const RENT_PATH = "/rent";

async function session() {
  const landlord = await requireLandlord(RENT_PATH);
  return { landlordId: landlord.landlordId, db: await createSupabaseServerClient(), today: kolkataToday(new Date()) };
}

function done<T extends Result<object>>(result: T): T {
  if (result.ok) refresh();
  return result;
}

/** L04-FRM-MARKPAID / L05-BTN-MARKPAID → one payment row, receipt allocated (D-10, D-12). */
export async function markPaidAction(input: {
  rentEntryId: string;
  amount: number;
  receivedOn: string;
  reference: string;
}) {
  const { landlordId, db, today } = await session();
  return done(
    await recordPayments(db, landlordId, {
      items: [{ rentEntryId: input.rentEntryId, amount: input.amount }],
      receivedOn: input.receivedOn,
      reference: input.reference,
      today,
    }),
  );
}

/** Bulk mark-paid: full balance of each selected row, received today. */
export async function bulkMarkPaidAction(rentEntryIds: string[]) {
  const { landlordId, db, today } = await session();
  return done(await recordFullBalances(db, landlordId, { rentEntryIds, today }));
}

/** The toast's Undo (D-11): voids, keeping the receipt numbers. */
export async function undoPaymentsAction(paymentIds: string[]) {
  const { landlordId, db } = await session();
  return done(await voidPayments(db, landlordId, paymentIds, "undo"));
}

/** L05-BTN-VOIDPAYMENT † (D-11), behind a confirm dialog. */
export async function voidPaymentAction(paymentId: string) {
  const { landlordId, db } = await session();
  return done(await voidPayments(db, landlordId, [paymentId], "panel"));
}

/** L05-BTN-EDIT (D-25). */
export async function editAmountAction(input: { rentEntryId: string; next: number }) {
  const { landlordId, db, today } = await session();
  return done(await editAmountDue(db, landlordId, { ...input, today }));
}

/** L05-BTN-LOGCALL → a `message` of kind call, written by the composer's recordCall (D-17, D-41). */
export async function logCallAction(input: { rentEntryId: string; outcome: string; note: string }) {
  await session();
  return done(await logCall(input));
}

/** L04-BNR-ROWSMISSING "create them now": the same idempotent path as the 1st-of-month job (D-24). */
export async function createRentRowsAction(): Promise<Result<{ created: number }>> {
  const { db, today } = await session();
  try {
    const { created } = await generateRentRows(db, monthOf(today));
    return done({ ok: true, created });
  } catch {
    return { ok: false, error: "Could not create this month's rent rows. Try again." };
  }
}
