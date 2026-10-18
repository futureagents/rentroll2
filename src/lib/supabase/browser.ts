import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

// Anon-key client for client components.
export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
