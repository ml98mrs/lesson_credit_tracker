// components/banners/LowCreditBanner.tsx
import { formatMinutesAsHours } from "@/lib/formatters";

export default function LowCreditBanner({
  remainingMin,
  generatedAtLabel,
}: {
  remainingMin: number;
  generatedAtLabel?: string;
}) {
  // Generic 6-hour threshold (360 minutes)
  if (remainingMin > 360) return null;

  const remainingHours = formatMinutesAsHours(remainingMin); // "x.xx" string

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <strong>Low credit:</strong>{" "}
      You have only{" "}
      <span className="font-semibold">{remainingHours} hours</span> of credit
      remaining. Please consider purchasing more lessons to avoid interruption.
      {generatedAtLabel && (
        <div className="mt-1 text-[10px] text-amber-800/80">
          Checked on {generatedAtLabel}
        </div>
      )}
    </div>
  );
}
