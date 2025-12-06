// components/admin/StudentWarningStrip.tsx

import { formatMinutesAsHours } from "@/lib/formatters";
import type { LowCreditByDeliveryRow } from "@/lib/api/admin/lowCredit";
import { StatusPill } from "@/components/ui/StatusPill";

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

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {/* Overall (per-student view) */}
      {showGenericLow && (
        <StatusPill
          severity="warningSoft"
          label="Low credit overall (≤ 6h)"
          className="text-xs"
        />
      )}

      {lowCreditDynamic && (
        <StatusPill
          severity="warningSoft"
          label={`Buffer < 4h overall — remaining ${formatHours(
            lowCreditAlertRemainingHours,
          )} h, avg ${formatHours(
            lowCreditAlertAvgMonthHours,
          )} h, buffer ${formatHours(lowCreditAlertBufferHours)} h`}
          className="text-xs"
        />
      )}

      {/* Per-delivery warnings (from v_student_dynamic_credit_alerts_by_delivery) */}
      {onlineAlert?.isLowAny && (
        <StatusPill
          severity="warningSoft"
          label={`Low online credit — remaining ${formatHours(
            onlineAlert.remainingHours,
          )} h, avg ${formatHours(
            onlineAlert.avgMonthHours,
          )} h, buffer ${formatHours(onlineAlert.bufferHours)} h`}
          className="text-xs"
        />
      )}

      {f2fAlert?.isLowAny && (
        <StatusPill
          severity="warningSoft"
          label={`Low F2F credit — remaining ${formatHours(
            f2fAlert.remainingHours,
          )} h, avg ${formatHours(
            f2fAlert.avgMonthHours,
          )} h, buffer ${formatHours(f2fAlert.bufferHours)} h`}
          className="text-xs"
        />
      )}

      {/* Negative balance / overdraft warning */}
      {hasOverdraft && (
        <StatusPill
          severity="warningCritical"
          label={`Overdraft in use — student has ${formatMinutesAsHours(
            -overdraftMinutesRemaining,
          )} h in negative balance.`}
          className="text-xs"
        />
      )}

      {/* Expiring lots warning */}
      {expiringLotsCount > 0 && (
        <StatusPill
          severity="warningCritical"
          label={`${expiringLotsCount} lot${
            expiringLotsCount > 1 ? "s" : ""
          } expiring ≤ 30 days`}
          className="text-xs"
        />
      )}

      {/* All-clear state */}
      {noWarnings && (
        <StatusPill
          severity="success"
          label="All good — no warnings"
          className="text-xs"
        />
      )}
    </div>
  );
}
