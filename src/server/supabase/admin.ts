import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";

// Service-role client. Bypasses RLS. Server-only, never exposed to tenants
// or the browser.
export function createSupabaseAdminClient() {
  const { supabaseUrl } = publicEnv();
  const { supabaseServiceRoleKey } = serverEnv();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
