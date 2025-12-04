// lib/api/student/dashboard.ts

import { getServerSupabase } from "@/lib/supabase/server";
import type {
  StudentSncStatus,
  StudentCreditDeliverySummary,
  StudentAwardReasonSummary,
  StudentDeliveryLowCreditAlert,
} from "@/lib/types/students";
import type {
  VStudentCreditSummaryRow,
  VStudentCreditDeliverySummaryRow,
  VStudentAwardReasonSummaryRow,
  VStudentSncLessonRow,
  VStudentLastActivityRow,
} from "@/lib/types/views/student";
import type {
  VStudentDynamicCreditAlertByDeliveryRow,
} from "@/lib/types/views/credit";
import {
  creditLotRemainingBaseQuery,
  type CreditLotRemainingRow,
} from "@/lib/api/shared/creditLotsView";

import { computeStudentSncStatus } from "@/lib/domain/snc";
import {
  mapDeliveryAlertRow,
  mapCreditDeliverySummaryRow,
  mapAwardReasonRows,
} from "@/lib/domain/students";

// Convenience alias for the server Supabase client type
type ServerSupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

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

  // Low-credit alerts by delivery (purchased-only credit)
  lowCreditAlertsByDelivery: StudentDeliveryLowCreditAlert[];

  // Earliest mandatory expiry within 30 days (if any, UTC ISO date string)
  nextMandatoryExpiry?: string;

  // When this snapshot was generated (UTC ISO string)
  generatedAtIso: string;
  lastActivityAtUtc: string | null;
};

// ---- Internal helper result types ----------------------------------------

type CreditSummaryResult = {
  grantedMin: number;
  usedMin: number;
  remainingMin: number;
  nextMandatoryExpiry?: string;
};

type DeliverySplitResult = {
  purchasedInvoiceMin: number;
  deliveryRow: VStudentCreditDeliverySummaryRow | null;
};

// ---- Internal helper functions -------------------------------------------

async function fetchCreditSummary(
  supabase: ServerSupabaseClient,
  studentId: string,
): Promise<CreditSummaryResult> {
  // Overall summary (canonical totals)
  const { data: summaryRow, error: sumErr } = await supabase
    .from("v_student_credit_summary")
    .select(
      "student_id,total_granted_min,total_allocated_min,total_remaining_min,next_expiry_date",
    )
    .eq("student_id", studentId)
    .maybeSingle<VStudentCreditSummaryRow>();

  if (sumErr) {
    throw new Error(sumErr.message);
  }

  const grantedMin = summaryRow?.total_granted_min ?? 0;
  const usedMin = summaryRow?.total_allocated_min ?? 0;
  const remainingMin = summaryRow?.total_remaining_min ?? 0;

  // Earliest mandatory expiry within 30 days (for student banner)
  const { data: mandatoryRows, error: mandatoryErr } =
    await creditLotRemainingBaseQuery(supabase)
      .eq("student_id", studentId)
      .eq("state", "open")
      .eq("expiry_policy", "mandatory")
      .eq("expiry_within_30d", true)
      .order("expiry_date", { ascending: true })
      .limit(1);

  if (mandatoryErr) {
    throw new Error(mandatoryErr.message);
  }

  const mandatoryTyped =
    (mandatoryRows ?? []) as unknown as CreditLotRemainingRow[];

  const nextMandatoryExpiry =
    mandatoryTyped.length > 0
      ? mandatoryTyped[0].expiry_date ?? undefined
      : undefined;

  return {
    grantedMin,
    usedMin,
    remainingMin,
    nextMandatoryExpiry,
  };
}

async function fetchSncStatus(
  supabase: ServerSupabaseClient,
  studentId: string,
): Promise<StudentSncStatus | null> {
  const { data: sncLessonRows, error: sncErr } = await supabase
    .from("v_student_snc_lessons")
    .select("is_charged")
    .eq("student_id", studentId);

  if (sncErr) {
    throw new Error(sncErr.message);
  }

  const sncRowsTyped = (sncLessonRows ?? []) as VStudentSncLessonRow[];

  // Delegate counting logic to the domain helper
  return computeStudentSncStatus(sncRowsTyped);
}

async function fetchDeliverySplit(
  supabase: ServerSupabaseClient,
  studentId: string,
): Promise<DeliverySplitResult> {
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
    .maybeSingle<VStudentCreditDeliverySummaryRow>();

  if (deliveryErr) {
    throw new Error(deliveryErr.message);
  }

  const row =
    (deliveryRow ?? null) as VStudentCreditDeliverySummaryRow | null;

  const purchasedInvoiceMin = row?.purchased_min ?? 0;

  return {
    purchasedInvoiceMin,
    deliveryRow: row,
  };
}

async function fetchAwardReasons(
  supabase: ServerSupabaseClient,
  studentId: string,
): Promise<StudentAwardReasonSummary[]> {
  const { data: awardRows, error: awardErr } = await supabase
    .from("v_student_award_reason_summary")
    .select(
      "award_reason_code,granted_award_min,used_award_min,remaining_award_min",
    )
    .eq("student_id", studentId)
    .returns<VStudentAwardReasonSummaryRow[]>();

  if (awardErr) {
    throw new Error(awardErr.message);
  }

  // Centralised mapping in lib/domain/students
  return mapAwardReasonRows(awardRows ?? null);
}

async function fetchLowCreditAlertsByDelivery(
  supabase: ServerSupabaseClient,
  studentId: string,
): Promise<StudentDeliveryLowCreditAlert[]> {
  const { data: alertsRows, error: alertsErr } = await supabase
    .from("v_student_dynamic_credit_alerts_by_delivery")
    .select(
      [
        "student_id",
        "delivery",
        "remaining_minutes",
        "remaining_hours",
        "avg_month_hours",
        "buffer_hours",
        "is_generic_low",
        "is_dynamic_low",
        "is_low_any",
        "is_zero_purchased",
      ].join(","),
    )
    .eq("student_id", studentId)
    .returns<VStudentDynamicCreditAlertByDeliveryRow[]>();

  if (alertsErr) {
    throw new Error(alertsErr.message);
  }

  const rows = alertsRows ?? [];

  // Domain helper converts view row → StudentDeliveryLowCreditAlert
  return rows.map(mapDeliveryAlertRow);
}

async function fetchLastActivity(
  supabase: ServerSupabaseClient,
  studentId: string,
): Promise<string | null> {
  const { data: lastRow, error: lastErr } = await supabase
    .from("v_student_last_activity")
    .select("student_id,last_activity_at")
    .eq("student_id", studentId)
    .maybeSingle<VStudentLastActivityRow>();

  if (lastErr) {
    throw new Error(lastErr.message);
  }

  return lastRow?.last_activity_at ?? null;
}

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

  const [
    creditSummary,
    sncStatus,
    deliverySplit,
    awardReasons,
    lowCreditAlertsByDelivery,
    lastActivityAtUtc,
  ] = await Promise.all([
    fetchCreditSummary(supabase, studentId),
    fetchSncStatus(supabase, studentId),
    fetchDeliverySplit(supabase, studentId),
    fetchAwardReasons(supabase, studentId),
    fetchLowCreditAlertsByDelivery(supabase, studentId),
    fetchLastActivity(supabase, studentId),
  ]);

  const {
    grantedMin,
    usedMin,
    remainingMin,
    nextMandatoryExpiry,
  } = creditSummary;

  const { purchasedInvoiceMin, deliveryRow } = deliverySplit;

  // Canonical per-delivery mapping lives in lib/domain/students.ts
  const baseDeliverySummary = mapCreditDeliverySummaryRow(deliveryRow);

  const purchasedMin = purchasedInvoiceMin;
  const awardedMin = Math.max(grantedMin - purchasedMin, 0);

  const deliverySummary: StudentCreditDeliverySummary = {
    ...baseDeliverySummary,
    // Override top-level aggregates to match the spec:
    // - purchasedMin = invoice minutes (purchased_min)
    // - awardedMin   = total granted - purchased
    // - used/remaining from v_student_credit_summary (all credit)
    purchasedMin,
    awardedMin,
    usedMin,
    remainingMin,
  };

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
