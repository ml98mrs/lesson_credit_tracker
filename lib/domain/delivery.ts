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
