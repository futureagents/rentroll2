import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReceiptProps } from "@/app/print/receipt/receipt";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

// P-01 for the landlord (`/print/receipt/:paymentId`, D-03). Reads through the landlord's
// RLS-scoped client, so another landlord's payment id returns nothing (E4-5). Voided payments
// have no receipt (D-11). Flat queries for the same reason as board.ts: composite foreign keys
// make PostgREST embeds ambiguous.

const LOGO_URL_SECONDS = 10 * 60;
// A malformed id would be a Postgres cast error; treat it like any unknown id.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReceiptData = Omit<ReceiptProps, "autoPrint">;

export async function receiptForPayment(db: SupabaseClient, paymentId: string): Promise<ReceiptData | null> {
  if (!UUID.test(paymentId)) return null;

  const { data: payment } = await db
    .from("payment")
    .select("landlord_id, rent_entry_id, tenancy_id, amount, received_on, reference, receipt_number, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status !== "recorded") return null;

  const [entry, tenancy, landlord] = await Promise.all([
    db.from("rent_entry").select("month, unit_id").eq("id", payment.rent_entry_id).maybeSingle(),
    db.from("tenancy").select("name").eq("id", payment.tenancy_id).maybeSingle(),
    db
      .from("landlord")
      .select("id, name, receipt_name, upi_id, logo_document_id")
      .eq("id", payment.landlord_id)
      .maybeSingle(),
  ]);
  if (!entry.data || !tenancy.data || !landlord.data) return null;

  const { data: unit } = await db
    .from("unit")
    .select("unit_number, property_id")
    .eq("id", entry.data.unit_id)
    .maybeSingle();
  if (!unit) return null;
  const { data: property } = await db.from("property").select("name").eq("id", unit.property_id).maybeSingle();
  if (!property) return null;

  return {
    receiptNumber: payment.receipt_number,
    tenantName: tenancy.data.name,
    unitNumber: unit.unit_number,
    propertyName: property.name,
    month: (entry.data.month as string).slice(0, 7),
    amount: payment.amount,
    receivedOn: payment.received_on,
    reference: payment.reference,
    landlord: {
      // D-26: the receipt name; until L-15 sets one, the landlord's own name stands in.
      receiptName: landlord.data.receipt_name?.trim() || landlord.data.name,
      upiId: landlord.data.upi_id,
      logoUrl: await logoUrl(db, landlord.data.id, landlord.data.logo_document_id),
    },
  };
}

// The documents bucket has no object policies (D-15): the logo row is read under RLS, then signed
// with the service client, and only for a path inside the landlord's own folder.
async function logoUrl(db: SupabaseClient, landlordId: string, documentId: string | null): Promise<string | null> {
  if (!documentId) return null;
  const { data: doc } = await db
    .from("document")
    .select("storage_path, type")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.type !== "logo" || !doc.storage_path.startsWith(`${landlordId}/`)) return null;
  const { data } = await createSupabaseAdminClient()
    .storage.from("documents")
    .createSignedUrl(doc.storage_path, LOGO_URL_SECONDS);
  return data?.signedUrl ?? null;
}
