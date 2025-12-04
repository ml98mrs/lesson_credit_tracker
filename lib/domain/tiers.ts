// lib/domain/tiers.ts
//
// Pure tier helpers.
// - No Supabase / fetch / React.
// - Encapsulates labeling + ordering + simple predicates.

import { TIER, type Tier, type TierDisplay } from "@/lib/enums";

// All modern paid tiers in DB enum order.
export const TIER_VALUES: Tier[] = [...TIER];

// Internal sort order for display / filters.
const TIER_DISPLAY_ORDER: TierDisplay[] = ["basic", "premium", "elite", "legacy"];

/**
 * Compare two TierDisplay values for sorting.
 * Lower return value means "comes first".
 */
export function compareTierDisplay(a: TierDisplay, b: TierDisplay): number {
  const ia = TIER_DISPLAY_ORDER.indexOf(a);
  const ib = TIER_DISPLAY_ORDER.indexOf(b);
  return ia - ib;
}

/**
 * Format a tier for UI labels.
 *
 * NOTE: This is UI-safe but still domain-led — there is no
 * hard-coded pricing, only names.
 */
export function formatTierLabel(
  tier: TierDisplay | null | undefined,
): string {
  if (!tier) return "No tier";

  switch (tier) {
    case "basic":
      return "Basic";
    case "premium":
      return "Premium";
    case "elite":
      return "Elite";
    case "legacy":
      return "Legacy pricing";
    default:
      return tier;
  }
}

/**
 * Is this a "paid" tier in the modern pricing model?
 * (Basic / Premium / Elite).
 *
 * Legacy / null-tier are treated as not-paid-plan for messaging.
 */
export function isModernPaidTier(
  tier: TierDisplay | null | undefined,
): boolean {
  return tier === "basic" || tier === "premium" || tier === "elite";
}

/**
 * Convenience helpers for feature flags in UI text.
 */

export function isTopTier(tier: TierDisplay | null | undefined): boolean {
  return tier === "elite";
}

export function isMidOrTopTier(
  tier: TierDisplay | null | undefined,
): boolean {
  return tier === "premium" || tier === "elite";
}

/**
 * Convert a DB tier (Tier | null) to a TierDisplay for UI.
 * - null → "legacy" (optional behaviour; can be changed later)
 *
 * Keeping this here means you can change the mapping in one place.
 */
export function dbTierToDisplay(
  tier: Tier | null | undefined,
): TierDisplay | null {
  if (!tier) return "legacy";
  return tier;
}
/**
 * Generic dropdown label for a simple tier filter.
 * "" → "Any"
 */
export function formatTierFilterLabel(
  value: "" | Tier,
): string {
  if (value === "") return "Any";
  return formatTierLabel(value);
}

/**
 * Dropdown label for tier *restriction* filters
 * (e.g. "Premium only", "Unrestricted").
 */
export function formatTierRestrictionFilterLabel(
  value: "" | Tier | "unrestricted",
): string {
  if (value === "") return "Any";
  if (value === "unrestricted") return "Unrestricted";

  switch (value) {
    case "basic":
      return "Basic only";
    case "premium":
      return "Premium only";
    case "elite":
      return "Elite only";
    default:
      return String(value);
  }
}