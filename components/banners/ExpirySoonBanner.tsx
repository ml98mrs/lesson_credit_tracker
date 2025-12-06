// components/banners/ExpirySoonBanner.tsx

"use client";

import { formatDateTimeLondon } from "@/lib/formatters";
import type { ExpiryPolicy } from "@/lib/enums";
import {
  getExpiryPolicyLabel,
  getExpiryPolicyDescription,
} from "@/lib/domain/expiryPolicy";
import { AlertBanner } from "@/components/ui/AlertBanner";

type ExpirySoonBannerProps = {
  /**
   * UTC ISO string for the earliest mandatory expiry date.
   * If null/undefined, the banner is hidden.
   */
  expiryDateUtc?: string | null;

  /**
   * Expiry policy for the expiring credit.
   * For the student dashboard we currently only surface mandatory expiries,
   * so this defaults to "mandatory".
   */
  policy?: ExpiryPolicy;
};

export default function ExpirySoonBanner({
  expiryDateUtc,
  policy = "mandatory",
}: ExpirySoonBannerProps) {
  if (!expiryDateUtc) {
    return null;
  }

  const policyLabel = getExpiryPolicyLabel(policy);
  const policyDescription = getExpiryPolicyDescription(policy);
  const expiryLabel = formatDateTimeLondon(expiryDateUtc);

  return (
    <AlertBanner severity="warningSoft" className="mt-3">
      <div className="font-semibold">
        {policyLabel} – some credit is expiring soon
      </div>
      <div className="mt-0.5 text-xs">
        Some of your lesson credit will reach its expiry date by{" "}
        <span className="font-semibold">{expiryLabel}</span>.{" "}
        {policyDescription}
      </div>
    </AlertBanner>
  );
}
