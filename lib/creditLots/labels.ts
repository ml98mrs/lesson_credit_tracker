// ---------------------------------------------------------------------------
// Shared helpers for credit lot labels and UI display
// ---------------------------------------------------------------------------

export type CreditLotSource =
  | 'invoice'
  | 'award'
  | 'adjustment'
  | 'overdraft';

// Optional — if you want to expose structured label + icon + description
export interface SourceInfo {
  label: string;
  short: string;   // short label for tables
  long: string;    // long label for tooltips / details
}

/**
 * Map from source_type -> human readable labels
 */
export const SOURCE_LABELS: Record<CreditLotSource, SourceInfo> = {
  invoice: {
    label: "Invoice",
    short: "Invoice",
    long: "Paid credit from invoice",
  },
  award: {
    label: "Award",
    short: "Award",
    long: "Awarded credit (free / promotion / adjustment)",
  },
  adjustment: {
    label: "Adjustment",
    short: "Adjustment",
    long: "Manual admin adjustment",
  },
  overdraft: {
    label: "Overdraft",
    short: "Overdraft",
    long: "Automatically created negative-credit bucket",
  },
};

/**
 * Format a user-friendly label for a credit lot row.
 * Suitable for tables and student credit pages.
 */
export function formatLotLabel(
  source: CreditLotSource,
  externalRef?: string | null,
  awardReason?: string | null
): string {
  switch (source) {
    case "invoice":
      return externalRef ? `Invoice ${externalRef}` : "Invoice";

    case "award":
      return awardReason ? `Award — ${awardReason}` : "Award";

    case "overdraft":
      return "Overdraft";

    case "adjustment":
    default:
      return "Adjustment";
  }
}
