// lib/types/views/credit.ts
//
// Row types for credit-related SQL views:
//
// - v_student_dynamic_credit_alerts
// - v_student_dynamic_credit_alerts_by_delivery
// - v_credit_lot_remaining
//
// These mirror DB view shapes; keep them in sync with Supabase.

import type { Delivery, ExpiryPolicy, CreditLotState } from "@/lib/enums";

export type VStudentDynamicCreditAlertRow = {
  student_id: string;
  remaining_minutes: number | null;   // int4 -> number
  remaining_hours: string | null;     // numeric -> string
  avg_month_hours: string | null;     // numeric -> string
  buffer_hours: string | null;        // numeric -> string
  is_generic_low: boolean;
  is_dynamic_low: boolean;
  is_low_any: boolean;
};

export type VStudentDynamicCreditAlertByDeliveryRow = {
  student_id: string;
  delivery: Delivery;              // 🔄 tighten: no `| null`
  remaining_minutes: number | null;
  remaining_hours: string | null;  // numeric -> string
  avg_month_hours: string | null;
  buffer_hours: string | null;
  is_generic_low: boolean;
  is_dynamic_low: boolean;
  is_low_any: boolean;
  is_zero_purchased: boolean;      // already there
};

export type VCreditLotRemainingRow = {
  credit_lot_id: string;
  student_id: string;
  minutes_remaining: number | null;
  expiry_date: string | null;
  expiry_policy: ExpiryPolicy | null;
  expiry_within_30d: boolean | null;
  state: CreditLotState;
  days_to_expiry: number | null;
};
