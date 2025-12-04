// lib/types/views/credit.ts
//
// Row types for credit-related SQL views:
//
// - v_student_dynamic_credit_alerts
// - v_student_dynamic_credit_alerts_by_delivery
// - v_credit_lot_remaining
//
// These mirror DB view shapes; keep them in sync with Supabase.

import type {
  Delivery,
  ExpiryPolicy,
  CreditLotState,
} from "@/lib/enums";
import type { CreditLotSource } from "@/lib/creditLots/types";

export type VStudentDynamicCreditAlertRow = {
  student_id: string;

  // Core credit+usage metrics
  remaining_minutes: number | null;
  remaining_hours: string | null;   // numeric in DB → string in client
  avg_month_hours: string | null;   // numeric in DB → string in client
  buffer_hours: string | null;      // numeric in DB → string in client

  // Flags from v_student_dynamic_credit_alerts
  is_generic_low: boolean;
  is_dynamic_low: boolean;
  is_low_any: boolean;
};

export type VStudentDynamicCreditAlertByDeliveryRow = {
  student_id: string;
  delivery: Delivery;               // per-delivery row (online / f2f)

  remaining_minutes: number | null;
  remaining_hours: string | null;   // numeric in DB → string in client
  avg_month_hours: string | null;
  buffer_hours: string | null;

  is_generic_low: boolean;
  is_dynamic_low: boolean;
  is_low_any: boolean;
  is_zero_purchased: boolean;
};

export type VCreditLotRemainingRow = {
  credit_lot_id: string;
  student_id: string;

  // Lot identity / context
  source_type: CreditLotSource;     // invoice | award | adjustment | overdraft
  external_ref: string | null;      // e.g. INV-1234 (may be null)
  delivery_restriction: Delivery | null; // null = unrestricted (UI shows this as "hybrid")

  // Minutes
  minutes_granted: number | null;
  minutes_allocated: number | null;
  minutes_remaining: number | null;

  // Expiry
  expiry_date: string | null;
  expiry_policy: ExpiryPolicy | null;
  expiry_within_30d: boolean | null;
  days_to_expiry: number | null;

  // Lot state
  state: CreditLotState;
};
