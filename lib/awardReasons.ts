// lib/awardReasons.ts (or wherever this lives)

import { formatMinutesAsHours } from "@/lib/formatters";

export const AWARD_REASON_CODES = [
  "free_cancellation",
  "goodwill",
  "promo",
  "trial",
] as const;

export type AwardReasonCode = (typeof AWARD_REASON_CODES)[number];

// Human-readable labels for each award reason
export const AWARD_REASON_LABELS: Record<AwardReasonCode, string> = {
  free_cancellation: "Free cancellation",
  goodwill: "Goodwill",
  promo: "Promo",
  trial: "Trial",
};

// Safe helper: falls back to the raw code if we don’t know it
export function getAwardReasonLabel(code: string): string {
  return AWARD_REASON_LABELS[code as AwardReasonCode] ?? code;
}

// Minimal shape of the summary rows coming from v_student_award_reason_summary
type AwardReasonSummaryRow = {
  award_reason_code: string;
  granted_award_min: number;
  used_award_min: number;
  remaining_award_min: number;
};

/**
 * Build a compact line like:
 *   "Goodwill: 1.50 h • Trial: 0.75 h"
 *
 * Returns null if there is nothing > 0 for that kind.
 */
export function buildAwardLine<T extends AwardReasonSummaryRow>(
  rows: T[],
  kind: "granted" | "used" | "remaining",
): string | null {
  const parts = rows
    .map((r) => {
      const label = getAwardReasonLabel(r.award_reason_code);

      const minutes =
        kind === "granted"
          ? r.granted_award_min
          : kind === "used"
          ? r.used_award_min
          : r.remaining_award_min;

      if (!minutes || minutes <= 0) return null;

      const hours = formatMinutesAsHours(minutes);
      return `${label}: ${hours} h`;
    })
    .filter(Boolean) as string[];

  if (parts.length === 0) return null;
  return `(${parts.join(" • ")})`;
}
