// components/admin/TierBadge.tsx
import React from "react";

export type Tier = "basic" | "premium" | "elite" | null;

const LABEL: Record<Exclude<Tier, null>, string> = {
  basic: "Basic",
  premium: "Premium",
  elite: "Elite",
};

export function TierBadge({ tier }: { tier: Tier }) {
  if (tier === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
        No package (legacy SNC rules)
      </span>
    );
  }

  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";

  if (tier === "basic") {
    return (
      <span className={`${base} bg-slate-100 text-slate-800`}>
        {LABEL.basic}
      </span>
    );
  }

  if (tier === "premium") {
    return (
      <span className={`${base} bg-emerald-100 text-emerald-800`}>
        {LABEL.premium}
      </span>
    );
  }

  // elite
  return (
    <span className={`${base} bg-indigo-100 text-indigo-800`}>
      {LABEL.elite}
    </span>
  );
}
