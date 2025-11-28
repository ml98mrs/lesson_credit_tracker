// lib/api/student/dashboard.ts

import { getServerSupabase } from "@/lib/supabase/server";
import type {
  StudentSncStatus,
  StudentCreditDeliverySummary,
  StudentAwardReasonSummary,
  StudentDeliveryLowCreditAlert,
} from "@/lib/types/students";

// ---- Types ---------------------------------------------------------------

export type StudentDashboardData = {
  studentId: string;

  // Canonical totals
  grantedMin: number;
  usedMin: number;
  remainingMin: number;

  // Breakdown by purchased vs award + delivery
  deliverySummary: StudentCreditDeliverySummary;

  // Award reason breakdown
  awardReasons: StudentAwardReasonSummary[];

  // SNC status (lifetime: all confirmed SNCs for this student)
  sncStatus: StudentSncStatus | null;

  // Low-credit alerts by delivery
  lowCreditAlertsByDelivery: StudentDeliveryLowCreditAlert[];

  // Earliest mandatory expiry within 30 days (if any)
  nextMandatoryExpiry?: string;

  // When this snapshot was generated (UTC ISO string)
  generatedAtIso: string;
  lastActivityAtUtc: string | null;
};

// ---- Internal row types (DB-shaped) --------------------------------------

type SummaryRow = {
  student_id: string;
  total_granted_min: number | null;
  total_allocated_min: number | null;
  total_remaining_min: number | null;
  next_expiry_date: string | null;
};

type DeliveryRow = {
  student_id: string;
  purchased_min: number | null;
  purchased_online_min: number | null;
  purchased_f2f_min: number | null;
  used_online_min: number | null;
  used_f2f_min: number | null;
  remaining_online_min: number | null;
  remaining_f2f_min: number | null;
};

type AwardReasonRow = {
  award_reason_code: string;
  granted_award_min: number | null;
  used_award_min: number | null;
  remaining_award_min: number | null;
};

// Lifetime SNC history rows (from v_student_snc_lessons)
type SncLessonRow = {
  is_charged: boolean | null;
};

type RawDeliveryAlertRow = {
  student_id: string;
  delivery: string;
  remaining_minutes: number;
  avg_month_hours: number | null;
  buffer_hours: number | null;
  is_generic_low: boolean;
  is_dynamic_low: boolean;
  is_low_any: boolean;
};

type LastActivityRow = {
  student_id: string;
  last_activity_at: string | null;
};

// ---- Public loader -------------------------------------------------------

/**
 * Load all data needed for the Student Dashboard for a single student.
 *
 * Caller is responsible for resolving `studentId` from the logged-in profile.
 */
export async function loadStudentDashboard(
  studentId: string,
): Promise<StudentDashboardData> {
  const supabase = await getServerSupabase();

  // Overall summary (canonical totals)
  const { data: summaryRow, error: sumErr } = await supabase
    .from("v_student_credit_summary")
    .select(
      "student_id,total_granted_min,total_allocated_min,total_remaining_min,next_expiry_date",
    )
    .eq("student_id", studentId)
    .maybeSingle<SummaryRow>();

  if (sumErr) {
    throw new Error(sumErr.message);
  }

  const grantedMin = summaryRow?.total_granted_min ?? 0;
  const usedMin = summaryRow?.total_allocated_min ?? 0;
  const remainingMin = summaryRow?.total_remaining_min ?? 0;

  // Earliest mandatory expiry within 30 days (for student banner)
  const { data: mandatoryExpiryRows, error: mandatoryExpiryErr } =
    await supabase
      .from("v_credit_lot_remaining")
      .select("expiry_date")
      .eq("student_id", studentId)
      .eq("state", "open")
      .eq("expiry_policy", "mandatory")
      .eq("expiry_within_30d", true)
      .order("expiry_date", { ascending: true })
      .limit(1);

  if (mandatoryExpiryErr) {
    throw new Error(mandatoryExpiryErr.message);
  }

  const nextMandatoryExpiry =
    mandatoryExpiryRows && mandatoryExpiryRows.length > 0
      ? (mandatoryExpiryRows[0].expiry_date as string)
      : undefined;

  // SNC status (lifetime, from v_student_snc_lessons)
  const { data: sncLessonRows, error: sncErr } = await supabase
    .from("v_student_snc_lessons")
    .select("is_charged")
    .eq("student_id", studentId);

  if (sncErr) {
    throw new Error(sncErr.message);
  }

  const sncRowsTyped = (sncLessonRows ?? []) as SncLessonRow[];

  let lifetimeFreeSncs = 0;
  let lifetimeChargedSncs = 0;

  for (const row of sncRowsTyped) {
    if (row.is_charged) {
      lifetimeChargedSncs += 1;
    } else {
      lifetimeFreeSncs += 1;
    }
  }

  const sncStatus: StudentSncStatus | null =
    sncRowsTyped.length === 0
      ? null
      : {
          freeSncs: lifetimeFreeSncs,
          chargedSncs: lifetimeChargedSncs,
          hasFreeSncUsed: lifetimeFreeSncs > 0,
        };

  // Delivery split (from invoice credit lots)
  const { data: deliveryRow, error: deliveryErr } = await supabase
    .from("v_student_credit_delivery_summary")
    .select(
      [
        "student_id",
        "purchased_min",
        "purchased_online_min",
        "purchased_f2f_min",
        "used_online_min",
        "used_f2f_min",
        "remaining_online_min",
        "remaining_f2f_min",
      ].join(","),
    )
    .eq("student_id", studentId)
    .maybeSingle<DeliveryRow>();

  if (deliveryErr) {
    throw new Error(deliveryErr.message);
  }

  const breakdown = deliveryRow ?? ({} as DeliveryRow);

  const purchasedInvoiceMin = breakdown.purchased_min ?? 0;

  const purchasedMin = purchasedInvoiceMin;
  const awardedMin = Math.max(grantedMin - purchasedMin, 0);

  const purchasedOnlineMin = breakdown.purchased_online_min ?? 0;
  const purchasedF2fMin = breakdown.purchased_f2f_min ?? 0;

  const usedOnlineMin = breakdown.used_online_min ?? 0;
  const usedF2fMin = breakdown.used_f2f_min ?? 0;

  const remainingOnlineMin = breakdown.remaining_online_min ?? 0;
  const remainingF2fMin = breakdown.remaining_f2f_min ?? 0;

  const deliverySummary: StudentCreditDeliverySummary = {
    purchasedMin,
    awardedMin,
    usedMin,
    remainingMin,
    purchasedOnlineMin,
    purchasedF2fMin,
    usedOnlineMin,
    usedF2fMin,
    remainingOnlineMin,
    remainingF2fMin,
  };

  // Award reason breakdown
  const { data: awardRows, error: awardErr } = await supabase
    .from("v_student_award_reason_summary")
    .select(
      "award_reason_code,granted_award_min,used_award_min,remaining_award_min",
    )
    .eq("student_id", studentId);

  if (awardErr) {
    throw new Error(awardErr.message);
  }

  const awardReasons: StudentAwardReasonSummary[] = (awardRows ?? []).map(
    (row: AwardReasonRow) => ({
      awardReasonCode: row.award_reason_code,
      grantedAwardMin: row.granted_award_min ?? 0,
      usedAwardMin: row.used_award_min ?? 0,
      remainingAwardMin: row.remaining_award_min ?? 0,
    }),
  );

  // Per-delivery dynamic low-credit alerts
  const { data: alertsRows, error: alertsErr } = await supabase
    .from("v_student_dynamic_credit_alerts_by_delivery")
    .select(
      "student_id,delivery,remaining_minutes,avg_month_hours,buffer_hours,is_generic_low,is_dynamic_low,is_low_any",
    )
    .eq("student_id", studentId);

  if (alertsErr) {
    throw new Error(alertsErr.message);
  }

  const alertRowsTyped = (alertsRows ?? []) as RawDeliveryAlertRow[];

  const lowCreditAlertsByDelivery: StudentDeliveryLowCreditAlert[] =
    alertRowsTyped.map((r) => ({
      delivery: r.delivery,
      remainingMinutes: r.remaining_minutes,
      avgMonthHours: r.avg_month_hours,
      bufferHours: r.buffer_hours,
      isGenericLow: r.is_generic_low,
      isDynamicLow: r.is_dynamic_low,
      isLowAny: r.is_low_any,
    }));

  // Last activity for this student (lessons or student.created_at)
  const { data: lastRow, error: lastErr } = await supabase
    .from("v_student_last_activity")
    .select("student_id,last_activity_at")
    .eq("student_id", studentId)
    .maybeSingle<LastActivityRow>();

  if (lastErr) {
    throw new Error(lastErr.message);
  }

  const lastActivityAtUtc = lastRow?.last_activity_at ?? null;

  const generatedAtIso = new Date().toISOString();

  return {
    studentId,
    grantedMin,
    usedMin,
    remainingMin,
    deliverySummary,
    awardReasons,
    sncStatus,
    lowCreditAlertsByDelivery,
    nextMandatoryExpiry,
    generatedAtIso,
    lastActivityAtUtc,
  };
}
