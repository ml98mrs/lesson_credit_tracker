// components/banners/LowCreditByDeliveryBanner.tsx

import { formatMinutesAsHours } from "@/lib/formatters";

type PerDeliveryAlert = {
  delivery: string; // "online" | "f2f"
  remainingMinutes: number;
  avgMonthHours: number | null;
  isGenericLow: boolean;
  isDynamicLow: boolean;
  isZero?: boolean;
};

type Props = {
  alerts: PerDeliveryAlert[];
  generatedAtLabel: string;
};

const formatDeliveryLabel = (delivery: string) => {
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
        const hoursLeft = formatMinutesAsHours(alert.remainingMinutes);
        const deliveryLabel = formatDeliveryLabel(alert.delivery);

        const isZero = alert.isZero ?? alert.remainingMinutes <= 0;

        // Red for zero purchased credit, amber for “running low”
        const borderClass = isZero ? "border-red-300" : "border-amber-300";
        const bgClass = isZero ? "bg-red-50" : "bg-amber-50";
        const textClass = isZero ? "text-red-800" : "text-amber-800";

        const title = isZero
          ? `No purchased ${deliveryLabel} credit left`
          : `Low ${deliveryLabel} credit`;

        const body = isZero
          ? `You’ve used up all of your purchased ${deliveryLabel} credit. Any remaining complimentary (free) credit isn’t included here.`
          : `You have ${hoursLeft} hours of purchased ${deliveryLabel} credit left. Complimentary (free) credit, if any, isn’t included in this number.`;

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
