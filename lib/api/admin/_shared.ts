// lib/api/admin/_shared.ts
//
// Shared types/helpers for admin API modules.
// Keep this file very small and focused.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Canonical admin Supabase client type.
 * We stay with `any` here until you wire in the generated Database type.
 */
export type AdminClient = SupabaseClient<any>;

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
  console.error(context, error);
}
