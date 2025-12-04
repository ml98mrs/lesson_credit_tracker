// lib/domain/students.ts

import type {
  StudentRow,
  StudentStatus,
  StudentCreditDeliverySummary,
  StudentAwardReasonSummary,
  StudentDeliveryLowCreditAlert,
} from "@/lib/types/students";
import type { VStudentDynamicCreditAlertByDeliveryRow } from "@/lib/types/views/credit";
import type {
  VStudentCreditDeliverySummaryRow,
  VStudentAwardReasonSummaryRow,
} from "@/lib/types/views/student";

import { normaliseHours, normaliseMinutes } from "@/lib/domain/numeric";

/**
 * Human-friendly label for student lifecycle status.
 * Keep wording central so Student 360 / admin lists stay in sync.
 */
export function formatStudentStatus(
  status: StudentRow["status"] | string,
): string {
  switch (status) {
    case "current":
      return "Current";
    case "dormant":
      return "Dormant";
    case "past":
      return "Past";
    default:
      return status;
  }
}

/**
 * Map a credit-delivery view row into the app-level summary type.
 *
 * All values remain minutes (DB convention); UI converts to hours.
 *
 * NOTE:
 * - This helper focuses on per-delivery splits from v_student_credit_delivery_summary.
 * - Top-level purchasedMin / awardedMin aggregates may be overridden by
 *   higher-level loaders (e.g. Student Dashboard) to match the spec’s
 *   canonical totals from v_student_credit_summary and invoice minutes.
 */
export function mapCreditDeliverySummaryRow(
  row: VStudentCreditDeliverySummaryRow | null,
): StudentCreditDeliverySummary {
  if (!row) {
    return {
      purchasedMin: 0,
      awardedMin: 0,
      usedMin: 0,
      remainingMin: 0,
      purchasedOnlineMin: 0,
      purchasedF2fMin: 0,
      usedOnlineMin: 0,
      usedF2fMin: 0,
      remainingOnlineMin: 0,
      remainingF2fMin: 0,
    };
  }

  const purchasedOnline = normaliseMinutes(row.purchased_online_min);
  const purchasedF2f = normaliseMinutes(row.purchased_f2f_min);

  const usedOnline = normaliseMinutes(row.used_online_min);
  const usedF2f = normaliseMinutes(row.used_f2f_min);

  const remainingOnline = normaliseMinutes(row.remaining_online_min);
  const remainingF2f = normaliseMinutes(row.remaining_f2f_min);

  return {
    purchasedMin: purchasedOnline + purchasedF2f,
    // awarded vs purchased split can be handled elsewhere if needed
    awardedMin: 0,
    usedMin: usedOnline + usedF2f,
    remainingMin: remainingOnline + remainingF2f,

    purchasedOnlineMin: purchasedOnline,
    purchasedF2fMin: purchasedF2f,

    usedOnlineMin: usedOnline,
    usedF2fMin: usedF2f,

    remainingOnlineMin: remainingOnline,
    remainingF2fMin: remainingF2f,
  };
}

/**
 * Map award reason view rows into a cleaner summary array.
 */
export function mapAwardReasonRows(
  rows: VStudentAwardReasonSummaryRow[] | null,
): StudentAwardReasonSummary[] {
  if (!rows || rows.length === 0) return [];

  return rows.map((r) => ({
    awardReasonCode: r.award_reason_code,
    grantedAwardMin: normaliseMinutes(r.granted_award_min),
    usedAwardMin: normaliseMinutes(r.used_award_min),
    remainingAwardMin: normaliseMinutes(r.remaining_award_min),
  }));
}

/**
 * Map a low-credit alert view row into the app-level alert model.
 * - Keeps minutes as minutes (DB convention).
 * - Normalises numeric hour fields (view strings) to numbers.
 */
export function mapDeliveryAlertRow(
  row: VStudentDynamicCreditAlertByDeliveryRow,
): StudentDeliveryLowCreditAlert {
  return {
    // view guarantees 'online' | 'f2f'
    delivery: row.delivery,

    remainingMinutes: normaliseMinutes(row.remaining_minutes),

    avgMonthHours: normaliseHours(row.avg_month_hours),
    bufferHours: normaliseHours(row.buffer_hours),

    isGenericLow: row.is_generic_low,
    isDynamicLow: row.is_dynamic_low,
    isLowAny: row.is_low_any,
    isZeroPurchased: row.is_zero_purchased,
  };
}

export function getStudentStatusBadgeClass(
  status: StudentStatus | null | undefined,
): string {
  switch (status) {
    case "current":
      return "bg-emerald-50 text-emerald-700";
    case "dormant":
      return "bg-amber-50 text-amber-700";
    case "past":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}