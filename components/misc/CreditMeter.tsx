// components/misc/CreditMeter.tsx
import { formatMinutesAsHours } from "@/lib/formatters";

type CreditMeterProps = {
  // Total credit story (in minutes)
  grantedMin: number;
  usedMin: number;

  // Remaining minutes by delivery
  remainingOnlineMin?: number;
  remainingF2fMin?: number;

  // Optional purchased minutes by delivery (for better % bars)
  purchasedOnlineMin?: number;
  purchasedF2fMin?: number;
};

export default function CreditMeter({
  grantedMin,
  usedMin,
  remainingOnlineMin = 0,
  remainingF2fMin = 0,
  purchasedOnlineMin,
  purchasedF2fMin,
}: CreditMeterProps) {
  const safeGranted = Math.max(grantedMin, 0);
  const safeUsed = Math.max(Math.min(usedMin, safeGranted), 0);
  const totalRemainingMin = Math.max(safeGranted - safeUsed, 0);

  const remainingOnlineSafe = Math.max(remainingOnlineMin, 0);
  const remainingF2fSafe = Math.max(remainingF2fMin, 0);

  // Percentages: colour = REMAINING, grey = used
  const totalRemainingPct =
    safeGranted === 0 ? 0 : (totalRemainingMin / safeGranted) * 100;

  const hasPurchasedInfo =
    (purchasedOnlineMin ?? 0) > 0 && (purchasedF2fMin ?? 0) > 0;

  // Any remaining minutes at all
  const hasAnyRemaining = remainingOnlineSafe + remainingF2fSafe > 0;

  // Show split if they are truly bi-delivery (purchased both) and still have some credit
  const showSplit = hasPurchasedInfo && hasAnyRemaining;

  let onlinePct = 0;
  let f2fPct = 0;

  if (showSplit) {
    if (hasPurchasedInfo) {
      // Preferred: remaining vs purchased per delivery
      const po = purchasedOnlineMin ?? 0;
      const pf = purchasedF2fMin ?? 0;

      if (po > 0) {
        onlinePct = Math.max(
          0,
          Math.min((remainingOnlineSafe / po) * 100, 100),
        );
      }
      if (pf > 0) {
        f2fPct = Math.max(
          0,
          Math.min((remainingF2fSafe / pf) * 100, 100),
        );
      }
    } else {
      // Fallback: share of remaining between the two buckets
      const remainingTotal = remainingOnlineSafe + remainingF2fSafe;
      if (remainingTotal > 0) {
        onlinePct = (remainingOnlineSafe / remainingTotal) * 100;
        f2fPct = (remainingF2fSafe / remainingTotal) * 100;
      }
    }
  }

  // Labels in hours (all REMAINING)
  const totalRemainingHours = formatMinutesAsHours(totalRemainingMin);
  const remainingOnlineHours = formatMinutesAsHours(remainingOnlineSafe);
  const remainingF2fHours = formatMinutesAsHours(remainingF2fSafe);

  return (
    <div className="space-y-4">
      {/* Thick total bar: remaining vs granted */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>Total remaining</span>
          <span>{totalRemainingHours} h</span>
        </div>
        <div className="h-4 w-full rounded-full bg-gray-100">
          <div
            className="h-4 rounded-full bg-blue-900"
            style={{ width: `${totalRemainingPct}%` }}
          />
        </div>
      </div>

      {/* Optional split by delivery (remaining vs purchased per bucket) */}
      {showSplit && (
        <div className="space-y-2">
          <div>
            <div className="mb-0.5 flex justify-between text-xs text-gray-500">
              <span>Online remaining</span>
              <span>{remainingOnlineHours} h</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-sky-400"
                style={{ width: `${onlinePct}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex justify-between text-xs text-gray-500">
              <span>F2F remaining</span>
              <span>{remainingF2fHours} h</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-sky-400"
                style={{ width: `${f2fPct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
