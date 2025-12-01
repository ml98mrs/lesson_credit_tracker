// lib/domain/lengths.ts
//
// Helpers for lesson-length categories (LengthCat).

import type { LengthCat } from "@/lib/enums";

export const LENGTH_RESTRICTIONS: LengthCat[] = ["none", "60", "90", "120"];

/**
 * Human-readable label for a length restriction.
 */
export function formatLengthRestrictionLabel(length: LengthCat): string {
  switch (length) {
    case "none":
      return "No length restriction";
    case "60":
      return "60";
    case "90":
      return "90";
    case "120":
      return "120";
    default:
      return length;
  }
}
