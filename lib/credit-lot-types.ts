// ---------------------------------------------------------------------------
// Credit Lot — Shared Types
// ---------------------------------------------------------------------------

export type CreditLotSource =
  | "invoice"
  | "award"
  | "adjustment"
  | "overdraft";

export type CreditLotState =
  | "open"
  | "closed"
  | "expired";

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
