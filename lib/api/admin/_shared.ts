// lib/api/admin/_shared.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Canonical admin Supabase client type.
 * All admin helpers should use this.
 */
export type AdminClient = SupabaseClient<Database>;

export function getAdminClient(): AdminClient {
  return getAdminSupabase();
}

export function logAdminError(context: string, error: unknown) {
  if (!error) return;
  console.error(`[admin] ${context}`, error);
}
