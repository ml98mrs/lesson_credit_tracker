// lib/api/admin/_shared.ts
//
// Shared types/helpers for admin API modules.
// IMPORTANT: This should be the ONLY place that imports getAdminSupabase.
// All other admin API modules should use getAdminClient() instead.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Canonical admin Supabase client type.
 *
 * TODO: When you wire in the generated Database type, change this to:
 *   import type { Database } from "@/lib/database.types";
 *   export type AdminClient = SupabaseClient<Database>;
 */
export type AdminClient = SupabaseClient;

/**
 * Convenience factory so admin API modules don't all import getAdminSupabase directly.
 * If you later change how the admin client is created, you only touch this file.
 */
export function getAdminClient(): AdminClient {
  return getAdminSupabase();
}

/**
 * Standardised error logger for admin API helpers.
 * All "soft-fail to 0" functions should use this.
 */
export function logAdminError(context: string, error: unknown) {
  if (!error) return;
  console.error(`[admin] ${context}`, error);
}
