// components/credit/CreditSnapshot.tsx

import { formatMinutesAsHours } from "@/lib/formatters";

type CreditSnapshotProps = {
  // Minutes in DB
  purchasedMin: number;
  awardedMin: number;
  usedMin: number;
  remainingMin: number;

  purchasedOnlineMin: number;
  purchasedF2fMin: number;
  usedOnlineMin: number;
  usedF2fMin: number;
  remainingOnlineMin: number;
  remainingF2fMin: number;

  hasBothDeliveries: boolean;

  // Optional award reason lines
  awardedLine?: string | null;
  usedAwardLine?: string | null;
  remainingAwardLine?: string | null;
};

export function CreditSnapshot({
  purchasedMin,
  awardedMin,
  usedMin,
  remainingMin,
  purchasedOnlineMin,
  purchasedF2fMin,
  usedOnlineMin,
  usedF2fMin,
  remainingOnlineMin,
  remainingF2fMin,
  hasBothDeliveries,
  awardedLine,
  usedAwardLine,
  remainingAwardLine,
}: CreditSnapshotProps) {
  // Convert minutes -> hours (UI-only)
  const purchasedHours = formatMinutesAsHours(purchasedMin);
  const awardedHours = formatMinutesAsHours(awardedMin);
  const usedHours = formatMinutesAsHours(usedMin);
  const remainingHours = formatMinutesAsHours(remainingMin);

  const purchasedOnlineHours = formatMinutesAsHours(purchasedOnlineMin);
  const purchasedF2fHours = formatMinutesAsHours(purchasedF2fMin);

  const usedOnlineHours = formatMinutesAsHours(usedOnlineMin);
  const usedF2fHours = formatMinutesAsHours(usedF2fMin);

  const remainingOnlineHours = formatMinutesAsHours(remainingOnlineMin);
  const remainingF2fHours = formatMinutesAsHours(remainingF2fMin);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* Purchased */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Purchased
        </div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">
          {purchasedHours} h
        </div>
        {hasBothDeliveries && (
          <div className="mt-1 text-xs text-gray-500">
            Online: {purchasedOnlineHours} h · F2F: {purchasedF2fHours} h
          </div>
        )}
      </div>

      {/* Awarded */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Awarded / bonus
        </div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">
          {awardedHours} h
        </div>
        {awardedLine && (
          <div className="mt-1 text-xs text-gray-500">{awardedLine}</div>
        )}
      </div>

      {/* Used */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Used
        </div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">
          {usedHours} h
        </div>
        {hasBothDeliveries && (
          <div className="mt-1 text-xs text-gray-500">
            Online: {usedOnlineHours} h · F2F: {usedF2fHours} h
          </div>
        )}
        {usedAwardLine && (
          <div className="mt-1 text-xs text-gray-500">{usedAwardLine}</div>
        )}
      </div>

      {/* Remaining */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Remaining
          </div>
        </div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">
          {remainingHours} h
        </div>
        {hasBothDeliveries && (
          <div className="mt-1 text-xs text-gray-500">
            Online: {remainingOnlineHours} h · F2F: {remainingF2fHours} h
          </div>
        )}
        {remainingAwardLine && (
          <div className="mt-1 text-xs text-gray-500">
            {remainingAwardLine}
          </div>
        )}
      </div>
    </div>
  );
}
