// lib/domain/delivery.ts
import type { Delivery, DeliveryRestriction } from "@/lib/enums";

/**
 * Delivery domain helpers.
 *
 * DB reality:
 * - lessons.delivery is the delivery mode actually used for the lesson: 'online' | 'f2f'.
 * - credit_lots.delivery_restriction is 'online' | 'f2f' | null.
 *   - null means "unrestricted" in the database: the lot can be used for either delivery.
 *
 * UI layer:
 * - DeliveryUi = Delivery | 'hybrid'.
 *   - 'hybrid' is how we surface a null delivery_restriction in filters and badges:
 *     "Hybrid" = "usable for both online and F2F".
 * - DeliveryRestriction mirrors the DB shape: Delivery | null.
 *
 * Rule of thumb:
 * - Tables / compact views / exports
 *     → formatDeliveryLabel (short labels: "Online", "F2F").
 * - High-level UI / badges / filters (with hybrid)
 *     → formatDeliveryUiLabel (supports "Hybrid").
 *
 * Keep all mapping between DB and UI here so components don't reinvent it.
 */

// UI-level delivery type: DB enum plus optional "hybrid"
export type DeliveryUi = Delivery | "hybrid";

/**
 * Compact delivery label for tables / exports.
 * Does NOT support 'hybrid' (this is for actual lesson delivery / DB values).
 */
export function formatDeliveryLabel(d?: Delivery | null): string {
  if (!d) return "—";

  switch (d) {
    case "online":
      return "Online";
    case "f2f":
      return "F2F"; // short, matches lesson tables + spec
    default:
      // Should be unreachable if Delivery is a closed enum, but keeps TS happy.
      return String(d);
  }
}

/**
 * UI-facing label for delivery, including 'hybrid'.
 * Use this in badges, filters, and any high-level UI copy.
 */
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
      return String(d);
  }
}

/**
 * Values for restriction dropdowns / filters.
 * 'hybrid' represents "usable for both online & F2F" in the UI.
 */
export const DELIVERY_RESTRICTION_VALUES: DeliveryUi[] = [
  "online",
  "f2f",
  "hybrid",
];

/**
 * Human-readable label for delivery restrictions.
 * Use this specifically for "restriction" dropdowns / descriptions,
 * not for per-lesson delivery.
 */
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

/**
 * Map a DB delivery_restriction value to the UI-level DeliveryUi.
 * - null (unrestricted in DB) → "hybrid" (hybrid/unrestricted in UI).
 */
export function deliveryRestrictionToUi(
  restriction: DeliveryRestriction,
): DeliveryUi {
  return restriction ?? "hybrid";
}

/**
 * Map a UI-level DeliveryUi value back to a DB delivery_restriction.
 * - "hybrid" in UI → null in DB (unrestricted).
 * - undefined / null from UI → null in DB.
 */
export function deliveryUiToRestriction(
  ui: DeliveryUi | null | undefined,
): DeliveryRestriction {
  if (!ui) return null;
  return ui === "hybrid" ? null : ui;
}
