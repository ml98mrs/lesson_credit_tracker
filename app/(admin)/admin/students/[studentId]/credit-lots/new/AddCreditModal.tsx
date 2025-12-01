// app/(admin)/admin/students/[studentId]/credit-lots/new/AddCreditModal.tsx
"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  importInvoiceCredit,
  awardMinutesCredit,
} from "@/lib/api/admin/creditLots";
import type {
  LengthCat,
  Tier,
  ExpiryPolicy,
  DeliveryRestriction, 
} from "@/lib/enums";
import { TIER_VALUES, formatTierLabel } from "@/lib/domain/tiers";
import {
  type DeliveryUi,
  DELIVERY_RESTRICTION_VALUES,
  formatDeliveryRestrictionLabel,
} from "@/lib/domain/delivery";
import {
  AWARD_REASON_CODES,
  type AwardReasonCode,
  getAwardReasonLabel,
} from "@/lib/awardReasons";
import {
  LENGTH_RESTRICTIONS,
  formatLengthRestrictionLabel,
} from "@/lib/domain/lengths";
import {
  EXPIRY_POLICIES,
  getExpiryPolicyLabel,
  getExpiryPolicyDescription,
} from "@/lib/domain/expiryPolicy";

type Props = {
  studentId: string;
  open?: boolean; // optional, defaults to true
  onClose?: () => void; // optional – if omitted, we navigate back to student page
};

// helpers
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()),
  );
  return iso(dt);
}

function ceil(n: number) {
  return Math.ceil(n);
}

// expiry calc (matches rpc_import_invoice precedence when L/D present)
function computeExpiryPreview(opts: {
  startDate?: string | null; // S
  minutesGranted?: number | null; // M
  lessonsPerMonth?: number | null; // L
  durationPerLessonMins?: number | null; // D
  buffer?: number | null; // B (0.5 = 50%)
}) {
  const { startDate, minutesGranted, lessonsPerMonth, durationPerLessonMins } =
    opts;
  if (!startDate || !minutesGranted || minutesGranted <= 0) return null;

  const B = opts.buffer ?? 0.5;

  // If L and D are provided, mirror server math, else fallback 12 months.
  if (
    lessonsPerMonth &&
    lessonsPerMonth > 0 &&
    durationPerLessonMins &&
    durationPerLessonMins > 0
  ) {
    const lessonsNeeded = minutesGranted / durationPerLessonMins;
    const monthsNeeded = lessonsNeeded / lessonsPerMonth;
    const monthsFinal = Math.max(1, ceil(monthsNeeded * (1 + B)));
    return addMonths(startDate, monthsFinal);
  }

  // Fallback
  return addMonths(startDate, 12);
}

export default function AddCreditModal({
  studentId,
  open = true,
  onClose,
}: Props) {
  const router = useRouter();

  const [tab, setTab] = useState<"invoice" | "award">("invoice");

  // Shared state
  const [startDate, setStartDate] = useState<string>(() => iso(new Date()));

  // UI is in HOURS; backend expects MINUTES.
  // Keep hours as a string for the input, then derive minutes.
  const [hours, setHours] = useState<string>("");

  // Derived: total minutes to send to API / expiry calc
  const minutesGranted = useMemo(() => {
    const h = parseFloat(hours);
    if (!Number.isFinite(h) || h <= 0) return 0;
    return Math.round(h * 60); // convert hours → minutes (integer)
  }, [hours]);

  // Invoice amount (UI in £, DB in pennies)
  const [invoiceAmount, setInvoiceAmount] = useState<string>("");

  const amountPennies = useMemo(() => {
    const v = parseFloat(invoiceAmount);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.round(v * 100); // £ → pennies
  }, [invoiceAmount]);

  // Invoice tab state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [lengthRestriction, setLengthRestriction] =
    useState<LengthCat>("none");
  const [deliveryRestriction, setDeliveryRestriction] =
    useState<DeliveryRestriction>(null); // null = hybrid/unrestricted
  const [tierRestriction, setTierRestriction] =
  useState<Tier | null>(null);
  const [expiryPolicy, setExpiryPolicy] =
    useState<ExpiryPolicy>("none");

  // Expiry knobs S/L/D/M/B – store as strings, parse when needed
  const [lessonsPerMonth, setLessonsPerMonth] = useState<string>("");
  const [durationPerLessonMins, setDurationPerLessonMins] =
    useState<string>("");
  const [buffer, setBuffer] = useState<string>(""); // "0.5" means +50%

  const expiryPreview = useMemo(() => {
    const lpmStr =
      typeof lessonsPerMonth === "string"
        ? lessonsPerMonth
        : String(lessonsPerMonth ?? "");
    const dStr =
      typeof durationPerLessonMins === "string"
        ? durationPerLessonMins
        : String(durationPerLessonMins ?? "");
    const bStr =
      typeof buffer === "string" ? buffer : String(buffer ?? "");

    const lessonsPerMonthNum = lpmStr.trim() ? Number(lpmStr) : null;
    const durationPerLessonMinsNum = dStr.trim() ? Number(dStr) : null;
    const bufferNum = bStr.trim() ? Number(bStr) : null;

    return computeExpiryPreview({
      startDate,
      minutesGranted: minutesGranted || null,
      lessonsPerMonth: lessonsPerMonthNum,
      durationPerLessonMins: durationPerLessonMinsNum,
      buffer: bufferNum,
    });
  }, [startDate, minutesGranted, lessonsPerMonth, durationPerLessonMins, buffer]);


  // Award tab state
  const [awardReasonCode, setAwardReasonCode] =
    useState<AwardReasonCode>("goodwill");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [lastCreditLotId, setLastCreditLotId] = useState<string | null>(
    null,
  );

  // Clear messages + last lot ID when switching tabs
  React.useEffect(() => {
    setError(null);
    setOkMsg(null);
    setLastCreditLotId(null);
  }, [tab]);

  // Local close handler: use prop if provided, otherwise go back to student page
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      window.location.href = `/admin/students/${studentId}`;
    }
  }, [onClose, studentId]);

  async function submitInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMsg(null);
    setLastCreditLotId(null);

    try {
      const digits = invoiceNumber.replace(/\D/g, "");

      if (digits.length < 4 || digits.length > 5) {
        throw new Error("Invoice number must be 4–5 digits.");
      }

      const externalRef = `INV-${digits}`;

      if (!minutesGranted || minutesGranted <= 0) {
        // UI label is "Total hours", but we pass minutesGranted (hours→minutes)
        throw new Error("Total hours must be greater than 0 (minutes > 0).");
      }
      if (!startDate) throw new Error("Start date is required.");

      if (!amountPennies || amountPennies <= 0) {
        throw new Error("Invoice amount must be greater than 0.");
      }

      // Always send a valid LengthCat
      const cleanLengthRestriction: LengthCat = lengthRestriction ?? "none";

      const lessonsPerMonthNum = lessonsPerMonth.trim()
        ? Number(lessonsPerMonth)
        : null;
      const durationPerLessonMinsNum = durationPerLessonMins.trim()
        ? Number(durationPerLessonMins)
        : null;
      const bufferNum = buffer.trim() ? Number(buffer) : null;

      const result = await importInvoiceCredit({
        studentId,
        externalRef,
        minutesGranted,
        startDate,
        lengthRestriction: cleanLengthRestriction,
        deliveryRestriction,
        tierRestriction,
        // let the server compute expiry based on S/L/D/B; preview is UI-only
        expiryDate: null,
        expiryPolicy,
        lessonsPerMonth: lessonsPerMonthNum,
        durationPerLessonMins: durationPerLessonMinsNum,
        buffer: bufferNum,
        amountPennies,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      setLastCreditLotId(result.creditLotId);
      setOkMsg("Invoice credit added successfully.");

      // Refresh host route (e.g. Student 360) so credit updates immediately
      router.refresh();

      // Auto-close if parent controls the modal
      if (onClose) {
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Unknown error");
      } else {
        setError("Unknown error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAward(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMsg(null);
    setLastCreditLotId(null);

    try {
      if (!awardReasonCode) {
        throw new Error("Award reason is required.");
      }
      if (!minutesGranted || minutesGranted <= 0) {
        throw new Error("Total hours must be greater than 0.");
      }
      if (!startDate) {
        throw new Error("Start date is required.");
      }

      const result = await awardMinutesCredit({
        studentId,
        minutesGranted, // already hours→minutes (DB minutes)
        startDate,
        awardReasonCode,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      setLastCreditLotId(result.creditLotId);
      setOkMsg("Award credit added successfully.");

      // Ensure any hosting server components refresh
      router.refresh();

      // Auto-close if parent controls the modal
      if (onClose) {
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Unknown error");
      } else {
        setError("Unknown error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add credit</h2>
          <button
            className="rounded-md px-3 py-1 text-sm hover:bg-gray-100"
            onClick={handleClose}
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${
              tab === "invoice" ? "bg-black text-white" : "bg-gray-100"
            }`}
            onClick={() => setTab("invoice")}
          >
            Invoice
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${
              tab === "award" ? "bg-black text-white" : "bg-gray-100"
            }`}
            onClick={() => setTab("award")}
          >
            Award
          </button>
        </div>

        {/* Shared fields */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">
              Credit available from (Start date)
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border p-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Total hours (H)</span>
            <input
              type="number"
              name="totalHours"
              autoComplete="off"
              min={0.01}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="rounded-md border p-2"
            />
            <span className="text-xs text-gray-500">
              {minutesGranted || 0} minutes.
            </span>
          </label>
        </div>

        {tab === "invoice" ? (
          <form onSubmit={submitInvoice} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Xero #</span>
                <div className="flex overflow-hidden rounded-md border">
                  <span className="flex items-center bg-gray-50 px-2 text-sm text-gray-500">
                    INV-
                  </span>
                  <input
                    type="text"
                    name="invoiceNumber"
                    autoComplete="off"
                    inputMode="numeric"
                    pattern="[0-9]{4,5}"
                    maxLength={5}
                    value={invoiceNumber}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      setInvoiceNumber(digits.slice(0, 5));
                    }}
                    className="flex-1 border-0 p-2 outline-none"
                  />
                </div>
                <span className="text-xs text-gray-500">
                  4–5 digit Xero invoice number.
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Invoice total (£)</span>
                <input
                  type="number"
                  name="invoiceAmount"
                  autoComplete="off"
                  min={0.01}
                  step={0.01}
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="rounded-md border p-2"
                />
                <span className="text-xs text-gray-500">
                  {amountPennies || 0} pennies
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Expiry enforcement</span>
                <select
                  value={expiryPolicy}
                  onChange={(e) =>
                    setExpiryPolicy(e.target.value as ExpiryPolicy)
                  }
                  className="rounded-md border p-2"
                >
                  {EXPIRY_POLICIES.map((policy) => (
                    <option key={policy} value={policy}>
                      {getExpiryPolicyLabel(policy)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">
                  {getExpiryPolicyDescription(expiryPolicy)}
                </span>
              </label>

              <label className="flex flex-col gap-1">
  <span className="text-sm text-gray-600">Length restriction</span>
  <select
    value={lengthRestriction}
    onChange={(e) =>
      setLengthRestriction(e.target.value as LengthCat)
    }
    className="rounded-md border p-2"
  >
    {LENGTH_RESTRICTIONS.map((len) => (
      <option key={len} value={len}>
        {formatLengthRestrictionLabel(len)}
      </option>
    ))}
  </select>
</label>


              <label className="flex flex-col gap-1">
  <span className="text-sm text-gray-600">Delivery restriction</span>
  <select
    // null in DB = "hybrid" in UI
    value={(deliveryRestriction ?? "hybrid") as DeliveryUi}
    onChange={(e) => {
      const value = e.target.value as DeliveryUi;
      // map "hybrid" back to null for DB
      setDeliveryRestriction(value === "hybrid" ? null : value);
    }}
    className="rounded-md border p-2"
  >
    {DELIVERY_RESTRICTION_VALUES.map((value) => (
      <option key={value} value={value}>
        {formatDeliveryRestrictionLabel(value)}
      </option>
    ))}
  </select>
</label>


              <label className="flex flex-col gap-1">
    <span className="text-sm text-gray-600">Tier restriction</span>
    <select
      value={tierRestriction ?? ""}
      onChange={(e) => {
        const value = e.target.value as Tier | "";
        setTierRestriction(value === "" ? null : value);
      }}
      className="rounded-md border p-2"
    >
      <option value="">(none)</option>
      {TIER_VALUES.map((tier) => (
        <option key={tier} value={tier}>
          {formatTierLabel(tier)}
        </option>
      ))}
    </select>
  </label>
            </div>

                        <div className="rounded-lg border p-3">
              <div className="mb-2 font-medium">Expiry calculation</div>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">
                    Lessons per month (L)
                  </span>
                  <input
                    type="number"
                    name="lessonsPerMonth"
                    autoComplete="off"
                    min={1}
                    value={lessonsPerMonth}
                    onChange={(e) => setLessonsPerMonth(e.target.value)}
                    className="rounded-md border p-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">
                    Minutes per lesson (D)
                  </span>
                  <select
                    value={durationPerLessonMins}
                    onChange={(e) => setDurationPerLessonMins(e.target.value)}
                    className="rounded-md border p-2"
                  >
                    <option value="">(select)</option>
                    <option value="60">60</option>
                    <option value="90">90</option>
                    <option value="120">120</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">
                    Buffer B (0.5 = 50%)
                  </span>
                  <input
                    type="number"
                    name="expiryBuffer"
                    autoComplete="off"
                    step={0.1}
                    value={buffer}
                    onChange={(e) => setBuffer(e.target.value)}
                    className="rounded-md border p-2"
                    placeholder="0.5"
                  />
                </label>
              </div>

              <div className="mt-3 text-sm text-gray-700">
                Expiry preview:{" "}
                <span className="font-medium">
                  {expiryPreview ?? "—"}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {okMsg && (
              <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">
                <div>{okMsg}</div>
                {lastCreditLotId && (
                  <div className="mt-1 text-xs text-green-800">
                    Credit lot ID:{" "}
                    <code className="rounded bg-green-100 px-1 py-[1px]">
                      {lastCreditLotId}
                    </code>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disabled}
                className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save invoice credit"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitAward} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">
                  Award reason
                </span>
                <select
  value={awardReasonCode}
  onChange={(e) =>
    setAwardReasonCode(e.target.value as AwardReasonCode)
  }
  className="rounded-md border p-2"
>
  {AWARD_REASON_CODES.map((code) => (
    <option key={code} value={code}>
      {getAwardReasonLabel(code)}
    </option>
  ))}
</select>
              </label>
            </div>

            <div className="rounded-lg border p-3 text-sm text-gray-700">
              Awards <strong>never expire</strong>. They will be consumed{" "}
              <strong>after invoice credit</strong> (FIFO), before overdraft.
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {okMsg && (
              <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">
                <div>{okMsg}</div>
                {lastCreditLotId && (
                  <div className="mt-1 text-xs text-green-800">
                    Credit lot ID:{" "}
                    <code className="rounded bg-green-100 px-1 py-[1px]">
                      {lastCreditLotId}
                    </code>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disabled}
                className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save award credit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
