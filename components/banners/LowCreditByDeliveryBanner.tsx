// components/banners/LowCreditByDeliveryBanner.tsx
import { formatMinutesAsHours } from "@/lib/formatters";

type DeliveryAlert = {
  delivery: string;              // 'online' | 'f2f'
  remainingMinutes: number;
  avgMonthHours?: number | null;
  isGenericLow: boolean;
  isDynamicLow: boolean;
};

export default function LowCreditByDeliveryBanner({
  alerts,
  generatedAtLabel,
}: {
  alerts: DeliveryAlert[];
  generatedAtLabel?: string;
}) {
  if (!alerts.length) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <strong>Low credit by lesson delivery type:</strong>{" "}
      {alerts.map((a, idx) => {
        const label =
          a.delivery === "online"
            ? "online"
            : a.delivery === "f2f"
            ? "face-to-face"
            : a.delivery;

        const remainingHours = formatMinutesAsHours(a.remainingMinutes);
        const avg =
          a.avgMonthHours != null ? a.avgMonthHours.toFixed(2) : null;

        let message: string;
        if (a.isDynamicLow && avg !== null) {
          message = `${label} credit is running low: ${remainingHours} hours left, excluding any unused complimentary credit.`;
        } else {
          message = `${label} credit is below the 6-hour threshold: ${remainingHours} hours left.`;
        }

        return (
          <span key={a.delivery}>
            {idx > 0 && " "}
            {message}
          </span>
        );
      })}

      {generatedAtLabel && (
        <div className="mt-1 text-[10px] text-amber-800/80">
          Checked on {generatedAtLabel}
        </div>
      )}
    </div>
  );
}











