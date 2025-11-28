// components/banners/LowCreditByDeliveryBanner.tsx

import { formatMinutesAsHours } from "@/lib/formatters";
import type { Delivery } from "@/lib/enums";

type PerDeliveryAlert = {
  delivery: Delivery; // "online" | "f2f"
  remainingMinutes: number;
  avgMonthHours: number | null;
  isGenericLow: boolean;
  isDynamicLow: boolean;
  /**
   * True if there is no purchased credit left for this delivery.
   * Mirrors v_student_dynamic_credit_alerts_by_delivery.is_zero_purchased.
   * If omitted, we fall back to remainingMinutes <= 0.
   */
  isZeroPurchased?: boolean;
};

type Props = {
  alerts: PerDeliveryAlert[];
  generatedAtLabel: string;
};

const formatDeliveryLabel = (delivery: Delivery) => {
  if (delivery === "online") return "online";
  if (delivery === "f2f") return "face-to-face";
  return delivery;
};

export default function LowCreditByDeliveryBanner({
  alerts,
  generatedAtLabel,
}: Props) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.map((alert) => {
        const deliveryLabel = formatDeliveryLabel(alert.delivery);

        // Prefer DB-driven zero flag; fall back to derived condition.
        const isZero =
          alert.isZeroPurchased ?? alert.remainingMinutes <= 0;

        // Clamp negative values for display
        const safeRemainingMinutes = Math.max(alert.remainingMinutes, 0);
        const hoursLeftStr = formatMinutesAsHours(safeRemainingMinutes);
        const hoursLeft = Number(hoursLeftStr);
        const hoursLabel = hoursLeft === 1 ? "hour" : "hours";

        // Red for zero purchased credit, amber for “running low”
        const borderClass = isZero ? "border-red-300" : "border-amber-300";
        const bgClass = isZero ? "bg-red-50" : "bg-amber-50";
        const textClass = isZero ? "text-red-800" : "text-amber-800";

        const title = isZero
          ? `No purchased ${deliveryLabel} credit left`
          : `Low ${deliveryLabel} credit`;

        const body = isZero
          ? `You’ve used up all of your purchased ${deliveryLabel} credit. Any remaining complimentary (free) credit isn’t included here.`
          : `You have ${hoursLeftStr} ${hoursLabel} of purchased ${deliveryLabel} credit left. Complimentary (free) credit, if any, isn’t included in this number.`;

        return (
          <div
            key={alert.delivery}
            className={`rounded-xl border px-4 py-3 text-sm ${borderClass} ${bgClass} ${textClass}`}
          >
            <div>
              <span className="font-semibold">{title}:</span>{" "}
              <span>{body}</span>
            </div>
            <div className="mt-1 text-xs opacity-80">
              Checked on {generatedAtLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}
