"use server";
// /dev/payment only. Reads the signed-in landlord's own settings row under RLS (D-04, D-20), so
// the preview can open S-02 against real data through a real network round trip.
import { payeeFromLandlord, type PaymentPayee } from "@/components/payment";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type MyPayeeResult =
  | { ok: true; payee: PaymentPayee | null; landlordName: string }
  | { ok: false; reason: "signed_out" | "failed" };

export async function loadMyPayee(): Promise<MyPayeeResult> {
  if (process.env.NODE_ENV !== "development") return { ok: false, reason: "failed" };
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "signed_out" };
    const { data, error } = await supabase
      .from("landlord")
      .select("name, upi_id, receipt_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (error || !data) return { ok: false, reason: "failed" };
    return { ok: true, payee: payeeFromLandlord(data), landlordName: data.name };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
