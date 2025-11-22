// lib/api/admin/lowCredit.ts
//
// Shared admin helpers for low-credit logic.
// IMPORTANT: all admin data access uses getAdminSupabase (service-role).

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase/admin";


type TypedClient = SupabaseClient<any>;

export type LowCreditAlertRow = {
  student_id: string;
  remaining_minutes: number | null;
  remaining_hours: number | null;
  avg_month_hours: number | null;
  buffer_hours: number | null;
  is_generic_low: boolean;
  is_dynamic_low: boolean;
  is_low_any: boolean;
};

export type LowCreditByDeliveryRow = {
  studentId: string;
  delivery: "online" | "f2f" | null;
  remainingMinutes: number | null;
  remainingHours: number | null;
  avgMonthHours: number | null;
  bufferHours: number | null;
  isGenericLow: boolean;
  isDynamicLow: boolean;
  isLowAny: boolean;
};

/**
 * Base query for low-credit alerts.
 * Single source of truth for what counts as "low" (generic + dynamic).
 */
export function lowCreditAlertsBaseQuery(sb: TypedClient) {
  return sb
    .from("v_student_dynamic_credit_alerts")
    .select(
      [
        "student_id",
        "remaining_minutes",
        "remaining_hours",
        "avg_month_hours",
        "buffer_hours",
        "is_generic_low",
        "is_dynamic_low",
        "is_low_any",
      ].join(","),
    );
}

/**
 * Convenience helper for the dashboard low-credit count.
 * Uses the same 'is_low_any' logic as the list page.
 */
export async function getLowCreditStudentsCount(): Promise<number> {
  const supabase = getAdminSupabase();

  const { count, error } = await supabase
    .from("v_student_dynamic_credit_alerts")
    .select("student_id", { count: "exact", head: true })
    .eq("is_low_any", true);

  if (error) {
    console.error("Error fetching low-credit count", error);
    return 0;
  }

  return count ?? 0;
}




/**
 * Low-credit alert for a single student (overall, not per-delivery).
 * Returns null if the student is not low-credit.
 */
export async function getLowCreditAlertForStudent(
  studentId: string,
): Promise<LowCreditAlertRow | null> {
  const supabase = getAdminSupabase();

  const { data, error } = await lowCreditAlertsBaseQuery(supabase)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching low-credit alert for student", {
      studentId,
      error,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  // Supabase types include GenericStringError in the row union;
  // we know this view shape, so we cast via unknown.
  return data as unknown as LowCreditAlertRow;
}

/**
 * Per-delivery low-credit alerts for a single student.
 * Backed by v_student_dynamic_credit_alerts_by_delivery.
 */
export async function getLowCreditAlertsByDeliveryForStudent(
  studentId: string,
): Promise<LowCreditByDeliveryRow[]> {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
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
      ].join(","),
    )
    .eq("student_id", studentId);

  if (error) {
    console.error(
      "Error fetching per-delivery low-credit alerts for student",
      { studentId, error },
    );
    return [];
  }

  return (data ?? []).map((row: any) => ({
    studentId: row.student_id as string,
    delivery: row.delivery as "online" | "f2f" | null,
    remainingMinutes: row.remaining_minutes as number | null,
    remainingHours: row.remaining_hours as number | null,
    avgMonthHours: row.avg_month_hours as number | null,
    bufferHours: row.buffer_hours as number | null,
    isGenericLow: row.is_generic_low as boolean,
    isDynamicLow: row.is_dynamic_low as boolean,
    isLowAny: row.is_low_any as boolean,
  }));
}
export type LowCreditCountsByDelivery = {
  online: number;
  f2f: number;
};

/**
 * All per-delivery low-credit alerts across students.
 * Backed by v_student_dynamic_credit_alerts_by_delivery, filtered to is_low_any = true.
 */
export async function getAllLowCreditAlertsByDelivery(): Promise<
  LowCreditByDeliveryRow[]
> {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
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
      ].join(","),
    )
    .eq("is_low_any", true);

  if (error) {
    console.error("Error fetching all per-delivery low-credit alerts", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    studentId: row.student_id as string,
    delivery: row.delivery as "online" | "f2f" | null,
    remainingMinutes: row.remaining_minutes as number | null,
    remainingHours: row.remaining_hours as number | null,
    avgMonthHours: row.avg_month_hours as number | null,
    bufferHours: row.buffer_hours as number | null,
    isGenericLow: row.is_generic_low as boolean,
    isDynamicLow: row.is_dynamic_low as boolean,
    isLowAny: row.is_low_any as boolean,
  }));
}


/**
 * Count of low-credit students by delivery, based on
 * v_student_dynamic_credit_alerts_by_delivery.
 *
 * - is_low_any = true (generic or dynamic low)
 * - counts distinct students per delivery
 */
export async function getLowCreditStudentsCountByDelivery(): Promise<LowCreditCountsByDelivery> {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("v_student_dynamic_credit_alerts_by_delivery")
    .select("student_id, delivery, is_low_any")
    .eq("is_low_any", true);

  if (error) {
    console.error("Error fetching low-credit counts by delivery", error);
    return { online: 0, f2f: 0 };
  }

  const online = new Set<string>();
  const f2f = new Set<string>();

  for (const row of data ?? []) {
    const delivery = (row as any).delivery as string | null;
    const studentId = (row as any).student_id as string | null;

    if (!studentId) continue;

    if (delivery === "online") {
      online.add(studentId);
    } else if (delivery === "f2f") {
      f2f.add(studentId);
    }
  }

  return {
    online: online.size,
    f2f: f2f.size,
  };
}
