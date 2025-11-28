// lib/types/profiles.ts
import type { Database } from "@/lib/database.types";

/**
 * Raw profiles row from the database.
 *
 * Includes fields such as:
 * - id
 * - full_name
 * - preferred_name
 * - timezone (FK to timezones.code)
 * - role
 * plus any other columns defined on the profiles table.
 */
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Shape of a `profiles` embed from Supabase when we only care
 * about full_name, as used in various simple queries:
 *
 *   select "..., profiles(full_name) ..."
 *
 * Supabase can return either a single object or an array of objects
 * depending on the relationship/cardinality, so we handle both.
 */
export type ProfilesEmbed =
  | { full_name: string }
  | { full_name: string }[]
  | null
  | undefined;

/**
 * Safely read the first full_name from a profiles embed.
 * Returns undefined if no profile is present.
 */
export function readProfileFullName(p: ProfilesEmbed): string | undefined {
  if (!p) return undefined;
  if (Array.isArray(p)) {
    return p[0]?.full_name;
  }
  return p.full_name;
}

/**
 * More flexible embed shape for when we have both preferred_name
 * and full_name available from Supabase, e.g.:
 *
 *   select "..., profiles(full_name, preferred_name) ..."
 *
 * Again, Supabase may return a single object or an array, so we
 * handle both, plus null/undefined.
 */
export type ProfilesDisplayEmbed =
  | { full_name?: string | null; preferred_name?: string | null }
  | { full_name?: string | null; preferred_name?: string | null }[]
  | null
  | undefined;

/**
 * Safely read a display name from a profiles embed, preferring
 * preferred_name, then falling back to full_name, then to the
 * provided fallback (if any).
 */
export function readProfileDisplayName(
  p: ProfilesDisplayEmbed,
  fallback?: string,
): string | undefined {
  if (!p) return fallback;

  const obj = Array.isArray(p) ? p[0] : p;

  return (
    (obj?.preferred_name as string | undefined | null) ??
    (obj?.full_name as string | undefined | null) ??
    fallback
  );
}
