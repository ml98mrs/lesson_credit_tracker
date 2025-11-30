//-------------------------------------------------------------------------
// Credit Lot — Shared Types
// ---------------------------------------------------------------------------

import type { CreditLotState } from "@/lib/enums";

// Canonical credit lot source type – used across colours, labels, ordering.
export type CreditLotSource =
  | "invoice"
  | "award"
  | "adjustment"
  | "overdraft";

// CreditLotState now comes from lib/enums.ts (includes "cancelled").
export interface CreditLot {
  credit_lot_id: string;
  student_id: string;
  source_type: CreditLotSource;
  award_reason_code: string | null;
  external_ref: string | null;
  minutes_granted: number;
  minutes_allocated: number;
  minutes_remaining: number;
  start_date: string;
  expiry_date: string | null;
  state: CreditLotState;
}

export interface Allocation {
  id: string;
  lesson_id: string;
  credit_lot_id: string;
  minutes_allocated: number;
}
