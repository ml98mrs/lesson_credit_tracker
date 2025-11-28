// components/banners/LowCreditBanner.tsx
import { formatMinutesAsHours } from "@/lib/formatters";

type LowCreditBannerProps = {
  remainingMin: number;
  generatedAtLabel?: string;
};

export default function LowCreditBanner({
  remainingMin,
  generatedAtLabel,
}: LowCreditBannerProps) {
  // Generic 6-hour threshold (360 minutes)
  if (remainingMin > 360) return null;

  // Don't show negative hours to students; clamp to zero for messaging
  const safeRemainingMin = Math.max(remainingMin, 0);
  const remainingHoursStr = formatMinutesAsHours(safeRemainingMin); // e.g. "1.50"
  const remainingHours = Number(remainingHoursStr);

  const hourLabel = remainingHours === 1 ? "hour" : "hours";

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <strong>Low credit:</strong>{" "}
      You have only{" "}
      <span className="font-semibold">
        {remainingHoursStr} {hourLabel}
      </span>{" "}
      of credit remaining. Please consider purchasing more lessons to avoid
      interruption.
      {generatedAtLabel && (
        <div className="mt-1 text-[10px] text-amber-800/80">
          Checked on {generatedAtLabel}
        </div>
      )}
    </div>
  );
}
