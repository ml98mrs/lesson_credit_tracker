// app/(admin)/admin/credit-invoices/[externalRefOrLotId]/page.tsx

import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import Section from "@/components/ui/Section";
import { formatDateTimeUK, formatMinutesAsHours } from "@/lib/formatters";

type CreditLot = {
  id: string;
  student_id: string;
  source_type: "invoice" | "award" | "overdraft" | "adjustment";
  award_reason_code: string | null;
  external_ref: string | null;
  minutes_granted: number;
  delivery_restriction: "online" | "f2f" | null;
  tier_restriction: "basic" | "standard" | "elite" | null;
  length_restriction: "none" | "60" | "90" | "120" | null;
  start_date: string | null;
  expiry_policy: "none" | "advisory" | "mandatory" | "default";
  expiry_date: string | null;
  state: "open" | "closed" | "expired" | "cancelled";
  created_at: string | null;
};

type Allocation = {
  id: string;
  lesson_id: string;
  credit_lot_id: string;
  minutes_allocated: number;
};

type LessonLite = {
  id: string;
  occurred_at: string | null;
};

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

export default async function Page({
  params,
}: {
  params: { externalRefOrLotId: string };
}) {
  const { externalRefOrLotId } = params;
  const key = decodeURIComponent(externalRefOrLotId);

  const sb = getAdminSupabase();

  //
  // 1) Fetch lot (by UUID OR by external_ref + source_type=invoice)
  //
  const selectColumns = [
    "id",
    "student_id",
    "source_type",
    "award_reason_code",
    "external_ref",
    "minutes_granted",
    "delivery_restriction",
    "tier_restriction",
    "length_restriction",
    "start_date",
    "expiry_policy",
    "expiry_date",
    "state",
    "created_at",
  ].join(",");

  let lot: CreditLot | null = null;
  let lotErrMsg: string | null = null;

  try {
    const baseQuery = sb.from("credit_lots").select(selectColumns).limit(1);

    // Cast the response to any to avoid noisy generic typing issues
    const { data, error } = (await (isUUID(key)
      ? baseQuery.eq("id", key)
      : baseQuery.eq("external_ref", key).eq("source_type", "invoice"))) as {
      data: any;
      error: any;
    };

    if (error) {
      lotErrMsg = error.message;
    } else if (Array.isArray(data) && data.length > 0) {
      lot = data[0] as CreditLot;
    }
  } catch (e: any) {
    lotErrMsg = e?.message ?? "Unknown error while loading lot";
  }

  if (lotErrMsg) {
    return (
      <Section title="Credit invoice">
        <p className="text-sm text-rose-700">Error loading lot: {lotErrMsg}</p>
      </Section>
    );
  }

  if (!lot) {
    return (
      <Section title="Credit invoice">
        <p className="text-sm text-gray-700">
          No invoice-backed credit lot found for <code>{key}</code>.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Tip: This page accepts the invoice number (<code>external_ref</code>)
          or the credit lot UUID.
        </p>
      </Section>
    );
  }

  //
  // 2) Remaining minutes (view is optional)
  //
  let minutesRemaining: number | null = null;
  try {
    const { data, error } = await sb
      .from("v_credit_lot_remaining")
      .select("credit_lot_id, minutes_remaining")
      .eq("credit_lot_id", lot.id)
      .maybeSingle();

    if (!error && data) {
      minutesRemaining = (data as any).minutes_remaining ?? null;
    }
  } catch {
    minutesRemaining = null;
  }

  //
  // 3) Allocations for this lot
  //
  let allocations: Allocation[] = [];
  let allocErrMsg: string | null = null;

  try {
    const { data, error } = await sb
      .from("allocations")
      .select("id, lesson_id, credit_lot_id, minutes_allocated")
      .eq("credit_lot_id", lot.id)
      .order("id", { ascending: true });

    if (error) {
      allocErrMsg = error.message;
    } else {
      allocations = (data ?? []) as Allocation[];
    }
  } catch (e: any) {
    allocErrMsg = e?.message ?? "Unknown error while loading allocations";
  }

  //
  // 4) Lesson dates (only if we have allocations)
  //
  let lessonsById = new Map<string, LessonLite>();

  if (allocations.length > 0) {
    try {
      const lessonIds = Array.from(
        new Set(allocations.map((a) => a.lesson_id))
      );
      const { data, error } = await sb
        .from("lessons")
        .select("id, occurred_at")
        .in("id", lessonIds);

      if (!error && Array.isArray(data)) {
        lessonsById = new Map(
          (data as LessonLite[]).map((L) => [L.id, L])
        );
      }
    } catch {
      // ignore; we just won't show dates
    }
  }

  const constraints =
    [
      lot.delivery_restriction
        ? lot.delivery_restriction === "f2f"
          ? "F2F only"
          : "Online only"
        : null,
      lot.tier_restriction ? `${lot.tier_restriction}` : null,
      lot.length_restriction && lot.length_restriction !== "none"
        ? `${lot.length_restriction} min only`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Any";

  const policyBadge =
    lot.expiry_policy === "default" ? "default (legacy)" : lot.expiry_policy;

  return (
    <Section title="Credit invoice" subtitle="(Linked credit lot)">
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-gray-500">Lot ID:</span> {lot.id}
        </div>
        <div>
          <span className="text-gray-500">Student:</span> {lot.student_id}
        </div>
        <div>
          <span className="text-gray-500">Source:</span> {lot.source_type}
        </div>
        <div>
          <span className="text-gray-500">Invoice #:</span>{" "}
          {lot.external_ref ?? "—"}
        </div>
        <div>
          <span className="text-gray-500">State:</span> {lot.state}
        </div>
        <div>
          <span className="text-gray-500">Created:</span>{" "}
          {lot.created_at ? formatDateTimeUK(lot.created_at) : "—"}
        </div>

        <div>
          <span className="text-gray-500">Minutes granted:</span>{" "}
          {lot.minutes_granted} min
          {typeof minutesRemaining === "number" && (
            <>
              {" "}
              · <span className="text-gray-500">Remaining:</span>{" "}
              {minutesRemaining} min (
              {formatMinutesAsHours(minutesRemaining)} h)
            </>
          )}
        </div>

        <div>
          <span className="text-gray-500">Start date:</span>{" "}
          {lot.start_date ? formatDateTimeUK(lot.start_date) : "—"}
        </div>
        <div>
          <span className="text-gray-500">Expiry policy:</span>{" "}
          {policyBadge}
        </div>
        <div>
          <span className="text-gray-500">Expiry date:</span>{" "}
          {lot.expiry_date ? formatDateTimeUK(lot.expiry_date) : "—"}
        </div>

        <div className="sm:col-span-2">
          <span className="text-gray-500">Constraints:</span>{" "}
          {constraints}
        </div>
      </div>

      <h3 className="mt-6 text-base font-semibold">Allocations</h3>
      {allocErrMsg ? (
        <p className="text-sm text-rose-700">
          Error loading allocations: {allocErrMsg}
        </p>
      ) : allocations.length === 0 ? (
        <p className="text-sm text-gray-600">No allocations yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Allocation ID</th>
                <th className="py-2 pr-4">Lesson</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Minutes</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => {
                const L = lessonsById.get(a.lesson_id);
                return (
                  <tr key={a.id} className="border-b">
                    <td className="py-2 pr-4">{a.id}</td>
                    <td className="py-2 pr-4">
                      <Link
                        className="underline"
                        href={`/admin/allocations?lessonId=${encodeURIComponent(
                          a.lesson_id
                        )}`}
                      >
                        {a.lesson_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {L?.occurred_at
                        ? formatDateTimeUK(L.occurred_at)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {a.minutes_allocated} min
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lot.expiry_policy === "default" && (
        <p className="mt-4 text-xs text-amber-700">
          This lot has a legacy expiry policy value <code>default</code>.
          Your current enum is <code>none | advisory | mandatory</code>. We
          can migrate these to <code>none</code> with a one-liner if you’d
          like.
        </p>
      )}
    </Section>
  );
}
