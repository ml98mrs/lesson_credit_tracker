// lib/domain/delivery.ts
import type { Delivery } from "@/lib/enums";

// UI-level delivery type: DB enum plus optional "hybrid"
export type DeliveryUi = Delivery | "hybrid";

export function formatDeliveryUiLabel(d?: DeliveryUi | null): string {
  if (!d) return "—";

  switch (d) {
    case "online":
      return "Online";
    case "f2f":
      return "Face to face";
    case "hybrid":
      return "Hybrid";
    default:
      return d;
  }
}
// For restriction dropdown specifically:
export const DELIVERY_RESTRICTION_VALUES: DeliveryUi[] = [
  "online",
  "f2f",
  "hybrid",
];

export function formatDeliveryRestrictionLabel(
  d: DeliveryUi | null | undefined,
): string {
  switch (d) {
    case "online":
      return "online only";
    case "f2f":
      return "face to face only";
    case "hybrid":
      return "hybrid (online & f2f)";
    default:
      return "—";
  }
}