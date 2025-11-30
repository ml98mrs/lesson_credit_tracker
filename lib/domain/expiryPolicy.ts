// lib/domain/expiry.ts
//
// Pure expiry-domain helpers.
// - No Supabase / fetch / React.
// - Mirrors expiry_policy rules from the spec.
//
// Spec (6.2):
// - mandatory: cannot use expired lot unless override
// - advisory: allow use after expiry (warning only)
// - none: ignore expiry

import type { ExpiryPolicy } from "@/lib/enums";

/**
 * True if this expiry policy *blocks* allocation when expired,
 * unless an admin override is explicitly requested.
 */
export function isExpiryBlocking(
  policy: ExpiryPolicy | null | undefined,
): boolean {
  return policy === "mandatory";
}

/**
 * True if this policy is advisory / warning-only.
 * (In your enum this is "advisory").
 */
export function isExpiryWarningOnly(
  policy: ExpiryPolicy | null | undefined,
): boolean {
  return policy === "advisory";
}

/**
 * Human-readable label for expiry policy.
 */
export function getExpiryPolicyLabel(
  policy: ExpiryPolicy | null | undefined,
): string {
  if (!policy) return "No expiry";

  switch (policy) {
    case "none":
      return "No expiry";
    case "mandatory":
      return "Hard expiry";
    case "advisory":
      return "Soft expiry";
    default:
      return policy;
  }
}

/**
 * Slightly longer description suitable for tooltips / help text.
 */
export function getExpiryPolicyDescription(
  policy: ExpiryPolicy | null | undefined,
): string {
  if (!policy || policy === "none") {
    return "This credit never expires. Lessons can always use it.";
  }

  if (policy === "mandatory") {
    return "After the expiry date, this credit cannot be used unless an admin overrides the expiry.";
  }

  // advisory
  return "After the expiry date, this credit can still be used, but it will be flagged as expired for reporting.";
}

/**
 * Helper for "expiring soon" banners when you already know
 * a lot is within the DB's expiry window (e.g. expiry_within_30d).
 *
 * This stays intentionally dumb: the *window* is owned by SQL;
 * we just produce copy.
 */
export function formatExpiringSoonBanner(
  policy: ExpiryPolicy,
): string {
  if (policy === "mandatory") {
    return "Some of this student's credit will hard-expire soon. Consider encouraging them to book lessons.";
  }

  if (policy === "advisory") {
    return "Some of this student's credit is approaching its advisory expiry date.";
  }

  return "Credit is marked as expiring soon.";
}
