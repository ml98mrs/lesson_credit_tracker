// components/admin/StudentSncHistory.tsx
import React from "react";
import type { Delivery } from "@/lib/enums";
import { formatDateTimeLondon } from "@/lib/formatters";
import { formatDeliveryUiLabel } from "@/lib/domain/delivery";

export type SncHistoryRow = {
  id: string;
  occurred_at: string;
  duration_min: number;
  delivery: Delivery;
  charged: boolean;
};

type Props = {
  sncRows: SncHistoryRow[];
  isLegacyTier: boolean;
  lifetimeFreeSncs: number;
  lifetimeChargedSncs: number;
  hasLifetimeFreeSnc: boolean;
};

export function StudentSncHistory({
  sncRows,
  isLegacyTier,
  lifetimeFreeSncs,
  lifetimeChargedSncs,
  hasLifetimeFreeSnc,
}: Props) {
  return (
    <div className="mt-10">
      {/* SNC status & rules (lifetime view) */}
      <div className="mb-4 text-xs text-gray-700">
        <span className="font-medium">Short-notice cancellations (to date): </span>
        <span>
          {lifetimeFreeSncs} free · {lifetimeChargedSncs} charged.{" "}
        </span>

        {isLegacyTier ? (
          hasLifetimeFreeSnc ? (
            <span className="ml-1 text-amber-700">
              Lifetime free SNC already used under legacy rules. Any future SNCs
              will be charged (no monthly reset).
            </span>
          ) : (
            <span className="ml-1 text-emerald-700">
              Under legacy rules, the first SNC is free; all later SNCs are
              charged. This student has not yet used their free SNC.
            </span>
          )
        ) : (
          <span className="ml-1 text-gray-700">
            For tiered students (basic/premium/elite), the earliest SNC in each
            calendar month is normally free and any additional SNCs in that month
            are charged. The counts above show this student&apos;s SNC history to
            date.
          </span>
        )}
      </div>

      <h2 className="mb-2 text-lg font-semibold">Short-notice cancellations</h2>

      {sncRows.length === 0 ? (
        <p className="text-sm text-gray-600">
          No short-notice cancellations logged for this student.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Delivery</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Charged?</th>
              </tr>
            </thead>
            <tbody>
              {sncRows.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 pr-4">
                    {formatDateTimeLondon(s.occurred_at)}
                  </td>
                  <td className="py-2 pr-4">
                    {formatDeliveryUiLabel(s.delivery)}
                  </td>
                  <td className="py-2 pr-4">{s.duration_min} min</td>
                  <td className="py-2 pr-4">
                    {s.charged ? (
                      <span className="font-medium text-rose-700">
                        Yes (minutes deducted)
                      </span>
                    ) : (
                      <span className="font-medium text-emerald-700">
                        No (free SNC)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
