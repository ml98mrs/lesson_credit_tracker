// lib/api/shared/creditLotsView.ts
import type { VCreditLotRemainingRow } from "@/lib/types/views/credit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function creditLotRemainingBaseQuery(
  sb: SupabaseClient<Database>,
) {
  return sb
    .from("v_credit_lot_remaining")
    .select(
      [
        "credit_lot_id",
        "student_id",
        "minutes_remaining",
        "minutes_granted",
        "minutes_allocated",
        "expiry_date",
        "expiry_policy",
        "expiry_within_30d",
        "state",
        "days_to_expiry",
        "delivery_restriction",
        "source_type",
        "external_ref",
      ].join(","),
    );
}

export type CreditLotRemainingRow = VCreditLotRemainingRow;
