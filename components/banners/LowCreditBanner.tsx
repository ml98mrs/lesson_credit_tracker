// components/banners/LowCreditBanner.tsx
import { formatMinutesAsHours } from "@/lib/formatters";
import { AlertBanner } from "@/components/ui/AlertBanner";

type LowCreditBannerProps = {
  remainingMin: number;
  generatedAtLabel?: string;
};

export default function LowCreditBanner({
  remainingMin,
  generatedAtLabel,
}: LowCreditBannerProps) {
  if (remainingMin > 360) return null;

  const safeRemainingMin = Math.max(remainingMin, 0);

  // 0 credit → critical business warning (red)
  if (safeRemainingMin === 0) {
    return (
      <AlertBanner severity="warningCritical" className="mb-4">
        <strong>No credit:</strong>{" "}
        You currently have{" "}
        <span className="font-semibold">no credit</span> remaining. Please
        purchase more lessons to continue without interruption.
        {generatedAtLabel && (
          <div className="mt-1 text-[10px] opacity-80">
            Checked on {generatedAtLabel}
          </div>
        )}
      </AlertBanner>
    );
  }

  // 0 < credit ≤ 6h → soft warning (amber)
  const remainingHoursStr = formatMinutesAsHours(safeRemainingMin);
  const remainingHours = Number(remainingHoursStr);
  const hourLabel = remainingHours === 1 ? "hour" : "hours";

  return (
    <AlertBanner severity="warningSoft" className="mb-4">
      <strong>Low credit:</strong>{" "}
      You have only{" "}
      <span className="font-semibold">
        {remainingHoursStr} {hourLabel}
      </span>{" "}
      of credit remaining. Please consider purchasing more lessons to avoid
      interruption.
      {generatedAtLabel && (
        <div className="mt-1 text-[10px] opacity-80">
          Checked on {generatedAtLabel}
        </div>
      )}
    </AlertBanner>
  );
}
