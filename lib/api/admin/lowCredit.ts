// lib/api/admin/lowCredit.ts
//
// Shared admin helpers for low-credit logic.
// IMPORTANT: all admin data access uses getAdminClient (service-role).

import {
  getAdminClient,
  type AdminClient,
  logAdminError,
} from "./_shared";
import type {
  VStudentDynamicCreditAlertRow,
  VStudentDynamicCreditAlertByDeliveryRow,
} from "@/lib/types/views/credit";
import type { Delivery } from "@/lib/enums";
import { normaliseHours } from "@/lib/domain/numeric";

// DB-shaped row from v_student_dynamic_credit_alerts
export type LowCreditAlertRow = VStudentDynamicCreditAlertRow;

// Domain-facing, camelCase shape for per-delivery alerts
export type LowCreditByDeliveryRow = {
  studentId: string;
  delivery: Delivery; // "online" | "f2f"
  remainingMinutes: number | null;
  remainingHours: number | null;
  avgMonthHours: number | null;
  bufferHours: number | null;
  isGenericLow: boolean;
  isDynamicLow: boolean;
  isLowAny: boolean;
};

export type LowCreditCountsByDelivery = {
  online: number;
  f2f: number;
};

// ---------------------------------------------------------------------------
// Shared column lists
// ---------------------------------------------------------------------------

const LOW_CREDIT_COLUMNS = [
  "student_id",
  "remaining_minutes",
  "remaining_hours",
  "avg_month_hours",
  "buffer_hours",
  "is_generic_low",
  "is_dynamic_low",
  "is_low_any",
] as const;

const LOW_CREDIT_BY_DELIVERY_COLUMNS = [
  ...LOW_CREDIT_COLUMNS,
  "delivery",
] as const;

// ---------------------------------------------------------------------------
// Base queries
// ---------------------------------------------------------------------------

/**
 * Base query for low-credit alerts (overall, not per-delivery).
 * Single source of truth for what counts as "low" (generic + dynamic).
 */
export function lowCreditAlertsBaseQuery(sb: AdminClient) {
  return sb
    .from("v_student_dynamic_credit_alerts")
    .select(LOW_CREDIT_COLUMNS.join(","));
}

/**
 * Base query for per-delivery low-credit alerts.
 */
function lowCreditAlertsByDeliveryBaseQuery(sb: AdminClient) {
  return sb
    .from("v_student_dynamic_credit_alerts_by_delivery")
    .select(LOW_CREDIT_BY_DELIVERY_COLUMNS.join(","));
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapLowCreditByDeliveryRow(
  row: VStudentDynamicCreditAlertByDeliveryRow,
): LowCreditByDeliveryRow {
  return {
    studentId: row.student_id,
    delivery: row.delivery,
    remainingMinutes: row.remaining_minutes,
    remainingHours: normaliseHours(row.remaining_hours),
    avgMonthHours: normaliseHours(row.avg_month_hours),
    bufferHours: normaliseHours(row.buffer_hours),
    isGenericLow: row.is_generic_low,
    isDynamicLow: row.is_dynamic_low,
    isLowAny: row.is_low_any,
  };
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Convenience helper for the dashboard low-credit count.
 * Uses the same 'is_low_any' logic as the list page.
 */
export async function getLowCreditStudentsCount(): Promise<number> {
  const supabase = getAdminClient();

  const { count, error } = await supabase
    .from("v_student_dynamic_credit_alerts")
    .select("student_id", { count: "exact", head: true })
    .eq("is_low_any", true);

  if (error) {
    logAdminError("Error fetching low-credit count", error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Low-credit alert for a single student (overall, not per-delivery).
 * Returns null if the student is not low-credit.
 *
 * NOTE: This returns the raw view row shape (hours as strings),
 * which is fine for internal admin-only uses.
 */
export async function getLowCreditAlertForStudent(
  studentId: string,
): Promise<LowCreditAlertRow | null> {
  const supabase = getAdminClient();

  const { data, error } = await lowCreditAlertsBaseQuery(supabase)
    .eq("student_id", studentId)
    .maybeSingle<VStudentDynamicCreditAlertRow>();

  if (error) {
    logAdminError("Error fetching low-credit alert for student", {
      studentId,
      error,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  return data;
}

/**
 * Per-delivery low-credit alerts for a single student.
 * Backed by v_student_dynamic_credit_alerts_by_delivery.
 */
export async function getLowCreditAlertsByDeliveryForStudent(
  studentId: string,
): Promise<LowCreditByDeliveryRow[]> {
  const supabase = getAdminClient();

  const { data, error } = await lowCreditAlertsByDeliveryBaseQuery(supabase)
    .eq("student_id", studentId);

  if (error) {
    logAdminError(
      "Error fetching per-delivery low-credit alerts for student",
      { studentId, error },
    );
    return [];
  }

  const rows =
    (data ?? []) as unknown as VStudentDynamicCreditAlertByDeliveryRow[];

  return rows.map(mapLowCreditByDeliveryRow);
}

/**
 * All per-delivery low-credit alerts across students.
 * Backed by v_student_dynamic_credit_alerts_by_delivery, filtered to is_low_any = true.
 */
export async function getAllLowCreditAlertsByDelivery(): Promise<
  LowCreditByDeliveryRow[]
> {
  const supabase = getAdminClient();

  const { data, error } = await lowCreditAlertsByDeliveryBaseQuery(supabase)
    .eq("is_low_any", true);

  if (error) {
    logAdminError("Error fetching all per-delivery low-credit alerts", error);
    return [];
  }

  const rows =
    (data ?? []) as unknown as VStudentDynamicCreditAlertByDeliveryRow[];

  return rows.map(mapLowCreditByDeliveryRow);
}

/**
 * Count of low-credit students by delivery, based on
 * v_student_dynamic_credit_alerts_by_delivery.
 *
 * - is_low_any = true (generic or dynamic low)
 * - counts distinct students per delivery
 */
export async function getLowCreditStudentsCountByDelivery(): Promise<LowCreditCountsByDelivery> {
  const supabase = getAdminClient();

  const { data, error } = await lowCreditAlertsByDeliveryBaseQuery(supabase)
    .eq("is_low_any", true);

  if (error) {
    logAdminError("Error fetching low-credit counts by delivery", error);
    return { online: 0, f2f: 0 };
  }

  const rows =
    (data ?? []) as unknown as VStudentDynamicCreditAlertByDeliveryRow[];

  const online = new Set<string>();
  const f2f = new Set<string>();

  for (const row of rows) {
    const studentId = row.student_id;
    if (!studentId) continue;

    if (row.delivery === "online") {
      online.add(studentId);
    } else if (row.delivery === "f2f") {
      f2f.add(studentId);
    }
  }

  return {
    online: online.size,
    f2f: f2f.size,
  };
}
