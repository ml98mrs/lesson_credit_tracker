import { CreditLot, CreditLotSource } from "./credit-lot-types";

// Matches your SQL CASE ordering
export function lotPriority(source: CreditLotSource): number {
  switch (source) {
    case "invoice":   return 0;
    case "award":     return 1;
    case "overdraft": return 2;
    case "adjustment":
    default:          return 3;
  }
}

// Sort lots FIFO for preview UIs
export function sortLotsFIFO(lots: CreditLot[]): CreditLot[] {
  return [...lots].sort((a, b) => {
    const pDiff = lotPriority(a.source_type) - lotPriority(b.source_type);
    if (pDiff !== 0) return pDiff;

    // fallback ordering same as SQL:
    // expiry → start_date → created_at → id
    const aExpiry = a.expiry_date ?? "9999-12-31";
    const bExpiry = b.expiry_date ?? "9999-12-31";

    if (aExpiry < bExpiry) return -1;
    if (aExpiry > bExpiry) return 1;

    if (a.start_date < b.start_date) return -1;
    if (a.start_date > b.start_date) return 1;

    return a.credit_lot_id.localeCompare(b.credit_lot_id);
  });
}
