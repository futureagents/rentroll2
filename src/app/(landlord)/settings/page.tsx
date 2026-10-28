import type { Metadata } from "next";

import { requireLandlord } from "@/server/auth/session";
import { tokenLinkBase } from "@/server/landlord/units/links";
import { getLandlordSettings } from "@/server/settings";
import { imageReadUrl } from "@/server/settings/images";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SettingsScreen } from "./settings-screen";

// L-15 · Settings (spec/screens/L-15.md, D-20, D-39 route `/settings`). Four sections, each saving
// on its own: Payment, Reminders, Contacts, and a read-only System section for the base URL.
export const metadata: Metadata = { title: "Settings · RentRoll" };

export default async function SettingsPage() {
  const landlord = await requireLandlord("/settings");
  const db = await createSupabaseServerClient();
  const settings = await getLandlordSettings(db);
  const admin = settings.logoDocumentId || settings.signatureDocumentId ? createSupabaseAdminClient() : null;
  const [logoUrl, signatureUrl] = admin
    ? await Promise.all([
        imageReadUrl(db, admin, landlord.landlordId, "logo", settings.logoDocumentId),
        imageReadUrl(db, admin, landlord.landlordId, "signature", settings.signatureDocumentId),
      ])
    : [null, null];

  // The address printed door QR codes and tenant links are built on (D-01, D-03). Configured by
  // whoever runs the app (APP_BASE_URL); shown here, never edited here.
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "") || null;
  const effective = await tokenLinkBase();

  return (
    <SettingsScreen
      settings={settings}
      imageUrls={{ logo: logoUrl, signature: signatureUrl }}
      baseUrl={{ configured, effective }}
    />
  );
}
