import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireLandlord } from "@/server/auth/session";
import { receiptForPayment } from "@/server/landlord/rent/receipt";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { Receipt } from "../receipt";

// P-01 · Rent receipt, the signed-in route behind L04-BTN-RECEIPT and L-05's print icon (D-03).
// The payment is read under RLS; another landlord's id or a voided payment is a 404 (E4-5, D-11).
export const metadata: Metadata = { title: "Rent receipt · RentRoll" };

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  await requireLandlord(`/print/receipt/${encodeURIComponent(paymentId)}`);

  const receipt = await receiptForPayment(await createSupabaseServerClient(), paymentId);
  if (!receipt) notFound();

  return <Receipt {...receipt} />;
}
