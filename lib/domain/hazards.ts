// lib/domain/hazards.ts
//
// Pure hazard-domain helpers.
// - No Supabase / fetch / React.
// - Works with v_lesson_hazards-style rows but does not know about Supabase.

import type { HazardType } from "@/lib/enums";

export type HazardSeverity = "info" | "warning" | "error";

export type HazardMeta = {
  type: HazardType;
  code: HazardType;
  severity: HazardSeverity;
  title: string;
  description?: string;
};

// Default severity per hazard type (domain-driven)
const HAZARD_DEFAULT_SEVERITY: Record<HazardType, HazardSeverity> = {
  overdraft_allocation: "error",
  snc_overuse: "error",
  delivery_f2f_on_online: "warning",
  delivery_online_on_f2f: "warning",
  length_restriction_mismatch: "warning",
  length_too_short: "info",
};

// Severity order for sorting
const SEVERITY_ORDER: Record<HazardSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

// Type-level priority for sorting within the same severity
const HAZARD_TYPE_PRIORITY: Record<HazardType, number> = {
  overdraft_allocation: 0,
  snc_overuse: 1,
  delivery_f2f_on_online: 2,
  delivery_online_on_f2f: 3,
  length_restriction_mismatch: 4,
  length_too_short: 5,
};

/**
 * Canonical metadata (severity, title, description) for a hazard type.
 * Used by admin hazards page and lesson review UI.
 */
export function getHazardMeta(type: HazardType): HazardMeta {
  const severity = HAZARD_DEFAULT_SEVERITY[type];

  let title: string;
  let description: string | undefined;

  switch (type) {
    case "overdraft_allocation":
      title = "Overdraft allocation";
      description =
        "This lesson used overdraft credit because no normal credit was available.";
      break;

    case "snc_overuse":
      title = "SNC overuse";
      description =
        "Short-notice cancellation allowance is exceeded; this SNC has been charged.";
      break;

    case "delivery_f2f_on_online":
      title = "Face-to-face lesson on online-only credit";
      description =
        "A face-to-face lesson is allocated to credit that is restricted to online lessons.";
      break;

    case "delivery_online_on_f2f":
      title = "Online lesson on F2F-only credit";
      description =
        "An online lesson is allocated to credit that is restricted to face-to-face lessons.";
      break;

    case "length_restriction_mismatch":
      title = "Length restriction mismatch";
      description =
        "The lesson length does not match the restriction on the allocated credit lot.";
      break;

    case "length_too_short":
      title = "Lesson shorter than standard length";
      description =
        "The lesson is shorter than the configured standard for this package or length category.";
      break;

    default: {
      // Exhaustive check – ensures we update this file when new hazards are added
      const _never: never = type;
      title = "Lesson hazard";
      break;
    }
  }

  return {
    type,
    code: type,
    severity,
    title,
    description,
  };
}

/**
 * Sort hazards for display:
 *   1) Higher-severity types first (error → warning → info)
 *   2) Then by domain priority within the same severity
 */
export function sortHazardsForDisplay<T extends { hazard_type: HazardType }>(
  hazards: T[],
): T[] {
  return [...hazards].sort((a, b) => {
    const metaA = getHazardMeta(a.hazard_type);
    const metaB = getHazardMeta(b.hazard_type);

    const sevDiff =
      SEVERITY_ORDER[metaA.severity] - SEVERITY_ORDER[metaB.severity];
    if (sevDiff !== 0) return sevDiff;

    const pa = HAZARD_TYPE_PRIORITY[a.hazard_type] ?? 99;
    const pb = HAZARD_TYPE_PRIORITY[b.hazard_type] ?? 99;

    if (pa !== pb) return pa - pb;

    // Stable-ish fallback: alphabetical by type
    if (a.hazard_type < b.hazard_type) return -1;
    if (a.hazard_type > b.hazard_type) return 1;
    return 0;
  });
}
