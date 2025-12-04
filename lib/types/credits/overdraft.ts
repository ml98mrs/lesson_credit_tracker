// lib/types/credits/overdraft.ts

import type { CreditWriteOffDirection } from "@/lib/enums";

/**
 * Generic “RPC ok” wrapper you can reuse for other JSON-returning RPCs
 * that follow the { ok: true, ...rest } convention.
 */
export type RpcOk<T> = T & { ok: true };

/**
 * Overdraft settlement (shared by rpc_award_overdraft / rpc_invoice_overdraft)
 *
 * Shape mirrors fn_settle_overdraft_common / the two RPCs:
 *
 * {
 *   ok: true,
 *   mode: 'award' | 'invoice',
 *   student_id: 'uuid',
 *   minutes_settled: number,
 *   overdraft_credit_lot_id: 'uuid'
 * }
 */
export type OverdraftSettlementMode = "award" | "invoice";

export type OverdraftSettlementResult = RpcOk<{
  mode: OverdraftSettlementMode;
  student_id: string; // uuid as string
  minutes_settled: number;
  overdraft_credit_lot_id: string;
}>;

/**
 * Overdraft write-off (shared by rpc_write_off_overdraft / rpc_write_off_overdraft_credit)
 *
 * Shape mirrors fn_write_off_overdraft_common:
 *
 * {
 *   ok: true,
 *   student_id: 'uuid',
 *   direction: 'negative',
 *   minutes_written_off: number,
 *   accounting_period: string
 * }
 *
 * NB: direction is a bit broader so you can reuse this type
 * if you later expose a positive write-off variant.
 */
export type OverdraftWriteOffResult = RpcOk<{
  student_id: string; // uuid as string
  direction: CreditWriteOffDirection;
  minutes_written_off: number;
  accounting_period: string; // e.g. "2025"
}>;

/**
 * Optional runtime type guards, if you ever want to be defensive
 * about RPC payloads.
 */
export function isOverdraftSettlementResult(
  value: unknown,
): value is OverdraftSettlementResult {
  if (!value || typeof value !== "object") return false;

  const v = value as Partial<OverdraftSettlementResult> & {
    [key: string]: unknown;
  };

  return (
    v.ok === true &&
    (v.mode === "award" || v.mode === "invoice") &&
    typeof v.student_id === "string" &&
    typeof v.minutes_settled === "number" &&
    typeof v.overdraft_credit_lot_id === "string"
  );
}

export function isOverdraftWriteOffResult(
  value: unknown,
): value is OverdraftWriteOffResult {
  if (!value || typeof value !== "object") return false;

  const v = value as Partial<OverdraftWriteOffResult> & {
    [key: string]: unknown;
  };

  return (
    v.ok === true &&
    (v.direction === "negative" || v.direction === "positive") &&
    typeof v.student_id === "string" &&
    typeof v.minutes_written_off === "number" &&
    typeof v.accounting_period === "string"
  );
}
