// components/admin/SNCInfoPanel.tsx
import React from "react";
import { TierBadge } from "./TierBadge";
import type { Tier } from "@/lib/enums";
import { AlertBanner } from "@/components/ui/AlertBanner";

// Keep this in sync with the API type
export type SncStats = {
  student_id: string;
  free_sncs: number;
  charged_sncs: number;
  has_free_snc_used: boolean;
};

type Props = {
  isSnc: boolean;
  sncStats: SncStats | null;
  studentTier: Tier | null;
};

export default function SNCInfoPanel({
  isSnc,
  sncStats,
  studentTier,
}: Props) {
  if (!isSnc) return null;

  const freeSncs = sncStats?.free_sncs ?? 0;
  const chargedSncs = sncStats?.charged_sncs ?? 0;
  const hasFreeUsed = sncStats?.has_free_snc_used ?? false;

  let explainer: string;

  // No stats at all – very defensive fallback
  if (!sncStats) {
    explainer =
      "No short-notice cancellation history found for this student yet. The SNC rules will be applied automatically when you confirm.";
  } else if (studentTier === "basic") {
    // BASIC: never free
    explainer =
      "Basic package — short-notice cancellations are always charged. Confirming this lesson will deduct minutes from the student's balance.";
  } else if (studentTier === "premium" || studentTier === "elite") {
    // PREMIUM / ELITE: earliest SNC in each calendar month is free
    if (!hasFreeUsed) {
      explainer =
        "Premium / Elite package — one free short-notice cancellation per calendar month. The free SNC allowance for this month is still available; the earliest SNC in this month will be treated as free and any others will deduct minutes.";
    } else {
      explainer =
        "Premium / Elite package — the free short-notice cancellation for this month has already been used. Any additional SNCs this month will deduct minutes from the student's balance.";
    }
  } else {
    // NULL tier (no package): one free SNC ever, no monthly reset
    if (!hasFreeUsed) {
      explainer =
        "No package (legacy SNC rules) — the first short-notice cancellation is free. The one-off free SNC has not been used yet; whichever SNC is confirmed first will not deduct minutes from the student's balance.";
    } else {
      explainer =
        "No package (legacy SNC rules) — the one-off free short-notice cancellation has already been used. All further SNCs will deduct minutes from the student's balance.";
    }
  }

  return (
    <AlertBanner severity="warningSoft" className="mt-4 rounded-2xl px-4 py-3 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="font-semibold tracking-wide uppercase">
          Short-notice cancellation
        </div>
        <TierBadge tier={studentTier ?? null} />
      </div>

      <div className="mb-1">
        Short-notice cancellations (this month):{" "}
        <span className="font-medium">
          {freeSncs} free · {chargedSncs} charged.
        </span>
      </div>

      <div>{explainer}</div>
    </AlertBanner>
  );
}
