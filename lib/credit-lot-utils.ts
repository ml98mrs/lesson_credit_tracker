import { CreditLot } from "./credit-lot-types";

export function minutesToHours(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

export function isExpiringSoon(
  lot: CreditLot,
  days: number = 30
): boolean {
  if (!lot.expiry_date) return false;
  const now = new Date();
  const expiry = new Date(lot.expiry_date);
  const threshold = new Date(now);
  threshold.setDate(now.getDate() + days);
  return expiry <= threshold;
}

export function isDepleted(lot: CreditLot): boolean {
  return lot.minutes_remaining <= 0;
}

export function hasWarning(lot: CreditLot): boolean {
  return isDepleted(lot) || isExpiringSoon(lot);
}
