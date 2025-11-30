// lib/domain/students.ts

import type {
  StudentRow,
  StudentCreditDeliverySummary,
  StudentAwardReasonSummary,
  StudentDeliveryLowCreditAlert,
} from "@/lib/types/students";

import type {
  VStudentCreditDeliverySummaryRow,
  VStudentAwardReasonSummaryRow,
} from "@/lib/types/views/student";
import type { VStudentDynamicCreditAlertByDeliveryRow } from "@/lib/types/views/credit";

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
 * All values remain minutes (DB convention); UI converts to hours.
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

  const purchasedOnline = row.purchased_online_min ?? 0;
  const purchasedF2f = row.purchased_f2f_min ?? 0;

  const usedOnline = row.used_online_min ?? 0;
  const usedF2f = row.used_f2f_min ?? 0;

  const remainingOnline = row.remaining_online_min ?? 0;
  const remainingF2f = row.remaining_f2f_min ?? 0;

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
    grantedAwardMin: r.granted_award_min ?? 0,
    usedAwardMin: r.used_award_min ?? 0,
    remainingAwardMin: r.remaining_award_min ?? 0,
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
    delivery: row.delivery, // view guarantees 'online' | 'f2f'

    remainingMinutes: row.remaining_minutes ?? 0,

    avgMonthHours:
      row.avg_month_hours != null ? Number(row.avg_month_hours) : null,

    bufferHours:
      row.buffer_hours != null ? Number(row.buffer_hours) : null,

    isGenericLow: row.is_generic_low,
    isDynamicLow: row.is_dynamic_low,
    isLowAny: row.is_low_any,
    isZeroPurchased: row.is_zero_purchased,
  };
}
