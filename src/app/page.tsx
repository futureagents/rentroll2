import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

// `/` has no screen of its own: signed out → L-01, signed in → L-04 rent board. L-04 rather than
// DASHBOARD_PATH (L-03) because L-03 is not built yet. Claims are verified locally, as in the
// landlord layout; /rent is a landlord path, so src/proxy.ts re-checks the session with getUser()
// and sends a stale one to sign-in (E4-6).
const SIGNED_IN_HOME = "/rent";

async function isSignedIn(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    return Boolean(data?.claims?.sub);
  } catch {
    return false;
  }
}

export default async function Home() {
  redirect((await isSignedIn()) ? SIGNED_IN_HOME : SIGN_IN_PATH);
}
