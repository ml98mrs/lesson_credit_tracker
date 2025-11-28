// lib/api/admin/expiringCredit.ts
//
// Read-only helpers for expiring credit.
// Uses v_credit_lot_remaining so all expiry rules live in SQL.

import { getAdminSupabase } from "@/lib/supabase/admin";
import type { ExpiryPolicy as ExpiryPolicyEnum } from "@/lib/enums";
import type { VCreditLotRemainingRow } from "@/lib/types/views/credit";

// Only "mandatory" and "advisory" are relevant for expiring-lot lists.
export type ExpiryPolicy = Extract<
  ExpiryPolicyEnum,
  "mandatory" | "advisory"
>;

export type ExpiringLotRow = {
  credit_lot_id: string;
  student_id: string;
  minutes_remaining: number;
  expiry_date: string | null;
  expiry_policy: ExpiryPolicy;
};

export type ExpiringStudentSummary = {
  studentId: string;
  lotCount: number;
  totalMinutes: number;
  earliestExpiryDate: string | null;
};

/**
 * Raw lots expiring within 30 days for a given expiry_policy.
 */
export async function getExpiringLotsByPolicy(
  policy: ExpiryPolicy,
): Promise<ExpiringLotRow[]> {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("v_credit_lot_remaining")
    .select(
      "credit_lot_id, student_id, minutes_remaining, expiry_date, expiry_policy, expiry_within_30d, state",
    )
    .eq("expiry_within_30d", true)
    .eq("state", "open")
    .gt("minutes_remaining", 0)
    .eq("expiry_policy", policy)
    .order("expiry_date", { ascending: true });

  if (error) {
    console.error("Error fetching expiring lots", error);
    return [];
  }

  const rows =
    (data ?? []) as VCreditLotRemainingRow[];

  // Map from generic view row → narrowed ExpiringLotRow
  return rows.map(
    (row): ExpiringLotRow => ({
      credit_lot_id: row.credit_lot_id,
      student_id: row.student_id,
      minutes_remaining: row.minutes_remaining ?? 0,
      expiry_date: row.expiry_date,
      // We know we're filtering by `policy`, so we can safely use it
      expiry_policy: policy,
    }),
  );
}

/**
 * Group expiring lots by student for a given policy.
 */
export async function getExpiringStudentsByPolicy(
  policy: ExpiryPolicy,
): Promise<ExpiringStudentSummary[]> {
  const lots = await getExpiringLotsByPolicy(policy);

  const byStudent = new Map<string, ExpiringStudentSummary>();

  for (const lot of lots) {
    const existing = byStudent.get(lot.student_id);

    const earliest =
      !existing?.earliestExpiryDate
        ? lot.expiry_date
        : !lot.expiry_date
        ? existing.earliestExpiryDate
        : lot.expiry_date < existing.earliestExpiryDate
        ? lot.expiry_date
        : existing.earliestExpiryDate;

    if (!existing) {
      byStudent.set(lot.student_id, {
        studentId: lot.student_id,
        lotCount: 1,
        totalMinutes: lot.minutes_remaining ?? 0,
        earliestExpiryDate: earliest,
      });
    } else {
      existing.lotCount += 1;
      existing.totalMinutes += lot.minutes_remaining ?? 0;
      existing.earliestExpiryDate = earliest;
    }
  }

  return Array.from(byStudent.values());
}
