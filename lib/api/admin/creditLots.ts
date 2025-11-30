/// lib/api/admin/creditLots.ts

import type {
  LengthCat,
  DeliveryRestriction,
  ExpiryPolicy,
} from "@/lib/enums";
import type { AwardReasonCode } from "@/lib/awardReasons";

export type ImportInvoicePayload = {
  studentId: string;
  externalRef: string;
  minutesGranted: number;  // minutes in DB
  amountPennies: number;   // total invoice amount in pennies
  startDate: string;       // "YYYY-MM-DD"

  // Restrictions & expiry – all reuse canonical enums
  lengthRestriction?: LengthCat;             // "60" | "90" | "120" | "none"
  deliveryRestriction?: DeliveryRestriction; // "online" | "f2f" | null
  tierRestriction?: string | null;
  expiryDate?: string | null;
  expiryPolicy?: ExpiryPolicy;               // "none" | "mandatory" | "advisory"

  // Dynamic-expiry tuning (optional)
  lessonsPerMonth?: number | null;
  durationPerLessonMins?: number | null;
  buffer?: number | null;
};

export type AwardMinutesPayload = {
  studentId: string;
  minutesGranted: number;  // minutes in DB
  startDate: string;       // "YYYY-MM-DD"
  awardReasonCode: AwardReasonCode;
};

export type CreditLotResult =
  | { ok: true; creditLotId: string; lot: any }
  | { ok: false; error: string };

export async function importInvoiceCredit(
  payload: ImportInvoicePayload,
): Promise<CreditLotResult> {
  const res = await fetch("/api/admin/credit-lots/import-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      error: "Unexpected response from server while importing invoice.",
    };
  }

  if (!res.ok || json?.ok === false) {
    return {
      ok: false,
      error: json?.error || "There was a problem importing this invoice.",
    };
  }

  return {
    ok: true,
    creditLotId: json.creditLotId,
    lot: json.lot,
  };
}

export async function awardMinutesCredit(
  payload: AwardMinutesPayload,
): Promise<CreditLotResult> {
  const res = await fetch("/api/admin/credit-lots/award-minutes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      error: "Unexpected response from server while awarding minutes.",
    };
  }

  if (!res.ok || json?.ok === false) {
    return {
      ok: false,
      error: json?.error || "There was a problem awarding minutes.",
    };
  }

  return {
    ok: true,
    creditLotId: json.creditLotId,
    lot: json.lot,
  };
}
