// lib/types/students.ts

/**
 * Student SNC status summary.
 * Currently interpreted as "lifetime counts" (all confirmed SNCs).
 */

import type { Database } from "@/lib/database.types";
import type { Delivery } from "@/lib/enums";

export type StudentRow = Database["public"]["Tables"]["students"]["Row"];

// Status type derived from the DB enum (canonical; do not reintroduce a local enum)
export type StudentStatus = StudentRow["status"];

export type StudentSncStatus = {
  freeSncs: number;
  chargedSncs: number;
  hasFreeSncUsed: boolean;
};

/**
 * Per-student credit breakdown used in dashboards / 360 views.
 * All values are minutes (DB convention); UI converts to hours.
 */
export type StudentCreditDeliverySummary = {
  purchasedMin: number;
  awardedMin: number;
  usedMin: number;
  remainingMin: number;

  purchasedOnlineMin: number;
  purchasedF2fMin: number;

  usedOnlineMin: number;
  usedF2fMin: number;

  remainingOnlineMin: number;
  remainingF2fMin: number;
};

/**
 * Award reason breakdown per student (aggregated).
 * Minutes are DB minutes.
 */
export type StudentAwardReasonSummary = {
  awardReasonCode: string;
  grantedAwardMin: number;
  usedAwardMin: number;
  remainingAwardMin: number;
};

/**
 * Per-delivery low-credit alert used in student dashboards.
 * Values mirror v_student_dynamic_credit_alerts_by_delivery:
 * - remainingMinutes: purchased-only minutes (invoice lots)
 * - avgMonthHours / bufferHours: usage-derived hours
 */
export type StudentDeliveryLowCreditAlert = {
  delivery: Delivery; // "online" | "f2f"
  remainingMinutes: number;
  avgMonthHours: number | null;
  bufferHours: number | null;
  isGenericLow: boolean;
  isDynamicLow: boolean;
  isLowAny: boolean;
  isZeroPurchased: boolean;
};
