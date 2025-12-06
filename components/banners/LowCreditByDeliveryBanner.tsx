// components/banners/LowCreditByDeliveryBanner.tsx
import { formatMinutesAsHours } from "@/lib/formatters";
import type { Delivery } from "@/lib/enums";
import { AlertBanner } from "@/components/ui/AlertBanner";

type PerDeliveryAlert = {
  delivery: Delivery;
  remainingMinutes: number;
  avgMonthHours: number | null;
  isGenericLow: boolean;
  isDynamicLow: boolean;
  isZeroPurchased?: boolean;
};

type Props = {
  alerts: PerDeliveryAlert[];
  generatedAtLabel: string;
};

const formatDeliveryLabel = (delivery: Delivery) =>
  delivery === "online" ? "online" : delivery === "f2f" ? "face-to-face" : delivery;

export default function LowCreditByDeliveryBanner({
  alerts,
  generatedAtLabel,
}: Props) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.map((alert) => {
        const deliveryLabel = formatDeliveryLabel(alert.delivery);

        const isZero =
          alert.isZeroPurchased ?? alert.remainingMinutes <= 0;

        const safeRemainingMinutes = Math.max(alert.remainingMinutes, 0);
        const hoursLeftStr = formatMinutesAsHours(safeRemainingMinutes);
        const hoursLeft = Number(hoursLeftStr);
        const hoursLabel = hoursLeft === 1 ? "hour" : "hours";

        const severity = isZero ? "warningCritical" : "warningSoft" as const;

        const title = isZero
          ? `No purchased ${deliveryLabel} credit left`
          : `Low ${deliveryLabel} credit`;

        const body = isZero
          ? `You’ve used up all of your purchased ${deliveryLabel} credit. Any remaining complimentary (free) credit isn’t included here.`
          : `You have ${hoursLeftStr} ${hoursLabel} of purchased ${deliveryLabel} credit left. Complimentary (free) credit, if any, isn’t included in this number.`;

        return (
          <AlertBanner
            key={alert.delivery}
            severity={severity}
            className="text-sm"
          >
            <div>
              <span className="font-semibold">{title}:</span>{" "}
              <span>{body}</span>
            </div>
            <div className="mt-1 text-xs opacity-80">
              Checked on {generatedAtLabel}
            </div>
          </AlertBanner>
        );
      })}
    </div>
  );
}
