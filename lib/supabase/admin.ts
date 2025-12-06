// lib/supabase/admin.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient<Database>(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
