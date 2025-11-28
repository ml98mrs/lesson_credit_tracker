// lib/domain/snc.ts
//
// Pure SNC domain helpers.
// - No Supabase / fetch / React.
// - Mirrors the tier + SNC rules from the spec.
// - Safe to use from admin, teacher, and student portals.

import type { Tier, SncMode } from "@/lib/enums";
import type { StudentSncStatus } from "@/lib/types/students";

/**
 * Minimal shape of rows coming from v_student_snc_lessons (or similar),
 * where we only care whether the SNC was charged.
 */
export type SncLessonChargeRow = {
  is_charged: boolean | null;
};

/**
 * Given all confirmed SNC lessons for a student, compute the lifetime SNC status.
 * This centralises the "count free vs charged" logic so both Student Dashboard
 * and Admin 360s can share it.
 */
export function computeStudentSncStatus<
  T extends SncLessonChargeRow,
>(rows: T[]): StudentSncStatus | null {
  if (!rows || rows.length === 0) {
    return null;
  }

  let lifetimeFreeSncs = 0;
  let lifetimeChargedSncs = 0;

  for (const row of rows) {
    if (row.is_charged) {
      lifetimeChargedSncs += 1;
    } else {
      lifetimeFreeSncs += 1;
    }
  }

  return {
    freeSncs: lifetimeFreeSncs,
    chargedSncs: lifetimeChargedSncs,
    hasFreeSncUsed: lifetimeFreeSncs > 0,
  };
}

// ───────────────────────────────────────────────────────────────
// SNC mode helpers
// ───────────────────────────────────────────────────────────────

export function isSnc(mode: SncMode | null | undefined): boolean {
  return mode === "free" || mode === "charged";
}

export function isFreeSnc(mode: SncMode | null | undefined): boolean {
  return mode === "free";
}

export function isChargedSnc(mode: SncMode | null | undefined): boolean {
  return mode === "charged";
}

// ───────────────────────────────────────────────────────────────
// Tier-based SNC allowance helpers (from spec)
// ───────────────────────────────────────────────────────────────
//
// Spec (DB / business rules):
// - basic → all SNCs charged
// - premium / elite → first SNC per calendar month free
// - null tier → exactly one free SNC ever

/**
 * True if this tier has a *monthly* free SNC allowance
 * (premium / elite in the spec).
 */
export function hasMonthlyFreeSncAllowance(
  tier: Tier | null | undefined,
): boolean {
  return tier === "premium" || tier === "elite";
}

/**
 * True if this student is on the "null tier" path where they get
 * exactly one free SNC ever.
 *
 * NOTE:
 * - In the DB this is represented as students.tier IS NULL.
 * - Some UIs may show this as "legacy" pricing – but that mapping
 *   should happen at the UI layer; this helper stays close to DB.
 */
export function hasLifetimeSingleFreeSncAllowance(
  tier: Tier | null | undefined,
): boolean {
  return tier == null;
}

/**
 * Human-readable description of SNC rules for a given tier,
 * suitable for tooltips / help text.
 */
export function describeSncAllowanceForTier(
  tier: Tier | null | undefined,
): string {
  if (tier == null) {
    return "Exactly one free short-notice cancellation ever; all later SNCs are charged.";
  }

  if (tier === "basic") {
    return "All short-notice cancellations are charged.";
  }

  // premium / elite
  return "One free short-notice cancellation per calendar month; additional SNCs are charged.";
}
