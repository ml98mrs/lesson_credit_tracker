// components/admin/StudentWarningStrip.tsx

import { formatMinutesAsHours } from "@/lib/formatters";
import type { LowCreditByDeliveryRow } from "@/lib/api/admin/lowCredit";

type StudentWarningStripProps = {
  lowCreditAny: boolean;
  showGenericLow: boolean;
  lowCreditDynamic: boolean;
  lowCreditAlertRemainingHours?: number | null;
  lowCreditAlertAvgMonthHours?: number | null;
  lowCreditAlertBufferHours?: number | null;
  onlineAlert?: LowCreditByDeliveryRow;
  f2fAlert?: LowCreditByDeliveryRow;
  anyPerDeliveryLow: boolean;
  hasOverdraft: boolean;
  overdraftMinutesRemaining: number;
  expiringLotsCount: number;
};

const formatHours = (h: number | null | undefined) =>
  h == null ? "—" : h.toFixed(2);

export function StudentWarningStrip({
  lowCreditAny,
  showGenericLow,
  lowCreditDynamic,
  lowCreditAlertRemainingHours,
  lowCreditAlertAvgMonthHours,
  lowCreditAlertBufferHours,
  onlineAlert,
  f2fAlert,
  anyPerDeliveryLow,
  hasOverdraft,
  overdraftMinutesRemaining,
  expiringLotsCount,
}: StudentWarningStripProps) {
  // All-clear state
  const noWarnings =
    !lowCreditAny &&
    !anyPerDeliveryLow &&
    expiringLotsCount === 0 &&
    !hasOverdraft;

  if (
    !showGenericLow &&
    !lowCreditDynamic &&
    !(onlineAlert?.isLowAny ?? false) &&
    !(f2fAlert?.isLowAny ?? false) &&
    !hasOverdraft &&
    expiringLotsCount === 0 &&
    noWarnings
  ) {
    // Still render the all-good pill below
  }

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {/* Overall (per-student view) */}
      {showGenericLow && (
        <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
          Low credit overall (≤ 6h)
        </span>
      )}

      {lowCreditDynamic && (
        <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
          Buffer &lt; 4h overall — remaining{" "}
          {formatHours(lowCreditAlertRemainingHours)} h, avg{" "}
          {formatHours(lowCreditAlertAvgMonthHours)} h, buffer{" "}
          {formatHours(lowCreditAlertBufferHours)} h
        </span>
      )}

      {/* Per-delivery warnings (from v_student_dynamic_credit_alerts_by_delivery) */}
      {onlineAlert?.isLowAny && (
        <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
          Low online credit — remaining{" "}
          {formatHours(onlineAlert.remainingHours)} h, avg{" "}
          {formatHours(onlineAlert.avgMonthHours)} h, buffer{" "}
          {formatHours(onlineAlert.bufferHours)} h
        </span>
      )}

      {f2fAlert?.isLowAny && (
        <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
          Low F2F credit — remaining{" "}
          {formatHours(f2fAlert.remainingHours)} h, avg{" "}
          {formatHours(f2fAlert.avgMonthHours)} h, buffer{" "}
          {formatHours(f2fAlert.bufferHours)} h
        </span>
      )}

      {/* Negative balance / overdraft warning */}
      {hasOverdraft && (
        <span className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-800">
          Overdraft in use — student has{" "}
          {formatMinutesAsHours(-overdraftMinutesRemaining)} h in negative
          balance.
        </span>
      )}

      {/* Expiring lots warning */}
      {expiringLotsCount > 0 && (
        <span className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-800">
          {expiringLotsCount} lot
          {expiringLotsCount > 1 ? "s" : ""} expiring ≤ 30 days
        </span>
      )}

      {/* All-clear state */}
      {noWarnings && (
        <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
          All good — no warnings
        </span>
      )}
    </div>
  );
}
