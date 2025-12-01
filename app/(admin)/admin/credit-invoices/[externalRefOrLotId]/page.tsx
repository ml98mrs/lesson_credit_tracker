// app/(admin)/admin/credit-invoices/[externalRefOrLotId]/page.tsx

import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import Section from "@/components/ui/Section";
import { formatDateTimeLondon, formatMinutesAsHours } from "@/lib/formatters";
import type { ProfilesEmbed } from "@/lib/types/profiles";
import { readProfileFullName } from "@/lib/types/profiles";

type CreditLot = {
  id: string;
  student_id: string;
  source_type: "invoice" | "award" | "overdraft" | "adjustment";
  award_reason_code: string | null;
  external_ref: string | null;
  minutes_granted: number;
  delivery_restriction: "online" | "f2f" | null;
  tier_restriction: "basic" | "premium" | "elite" | null;
  length_restriction: "none" | "60" | "90" | "120" | null;
  start_date: string | null;
  expiry_policy: "none" | "advisory" | "mandatory";
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

type StudentWithProfile = {
  id: string;
  profiles: ProfilesEmbed;
};

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ externalRefOrLotId: string }>;
}) {
  const { externalRefOrLotId } = await params;
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
    const baseQuery = sb.from("credit_lots").select(selectColumns);

    const { data, error } = isUUID(key)
      ? await baseQuery.eq("id", key).maybeSingle<CreditLot>()
      : await baseQuery
          .eq("external_ref", key)
          .eq("source_type", "invoice")
          .maybeSingle<CreditLot>();

    if (error) {
      lotErrMsg = error.message;
    } else {
      lot = data;
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      lotErrMsg = e.message;
    } else {
      lotErrMsg = "Unknown error while loading lot";
    }
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
  // 1b) Fetch student profile for full_name (via students → profiles)
  //
  let studentName: string | null = null;

  try {
const { data, error } = await sb
  .from("students")
  .select("id, profiles(full_name)")
  .eq("id", lot.student_id)
  .maybeSingle<StudentWithProfile>();

if (!error && data) {
  studentName = readProfileFullName(data.profiles) ?? null;
}
  } catch {
    // fall back to student_id
    studentName = null;
  }

  const displayStudentName = studentName ?? lot.student_id;

  //
  // 2) Remaining minutes (view is optional)
  //
  type RemainingRow = {
  credit_lot_id: string;
  minutes_remaining: number | null;
};

let minutesRemaining: number | null = null;
try {
  const { data, error } = await sb
    .from("v_credit_lot_remaining")
    .select("credit_lot_id, minutes_remaining")
    .eq("credit_lot_id", lot.id)
    .maybeSingle<RemainingRow>();

  if (!error && data) {
    minutesRemaining = data.minutes_remaining ?? null;
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
    .eq("credit_lot_id", lot.id);

  if (error) {
    allocErrMsg = error.message;
  } else {
    allocations = (data ?? []) as Allocation[];
  }
} catch (e: unknown) {
  if (e instanceof Error) {
    allocErrMsg = e.message;
  } else {
    allocErrMsg = "Unknown error while loading allocations";
  }
}


  //
  // 4) Lesson dates (only if we have allocations) + sort allocations
  //
  let lessonsById = new Map<string, LessonLite>();

  if (allocations.length > 0) {
    try {
      const lessonIds = Array.from(new Set(allocations.map((a) => a.lesson_id)));
      const { data, error } = await sb
        .from("lessons")
        .select("id, occurred_at")
        .in("id", lessonIds);

      if (!error && Array.isArray(data)) {
        lessonsById = new Map(
          (data as LessonLite[]).map((L) => [L.id, L]),
        );

        // Sort allocations by lesson occurred_at DESC (most recent first)
        allocations.sort((a, b) => {
          const aDate = lessonsById.get(a.lesson_id)?.occurred_at;
          const bDate = lessonsById.get(b.lesson_id)?.occurred_at;

          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;

          // ISO strings compare lexicographically in chronological order
          if (aDate < bDate) return 1;
          if (aDate > bDate) return -1;
          return 0;
        });
      }
    } catch {
      // ignore; we just won't show dates or custom sort
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

  const policyBadge = (() => {
    switch (lot.expiry_policy) {
      case "none":
        return "none (no expiry)";
      case "advisory":
        return "advisory (soft)";
      case "mandatory":
        return "mandatory (enforced)";
      default:
        return lot.expiry_policy;
    }
  })();

  return (
    <Section title="Credit invoice" subtitle="(Linked credit lot)">
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-gray-500">Lot ID:</span> {lot.id}
        </div>
        <div>
          <span className="text-gray-500">Student:</span>{" "}
          <Link
            href={`/admin/students/${lot.student_id}`}
            className="underline"
          >
            {displayStudentName}
          </Link>
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
          {lot.created_at ? formatDateTimeLondon(lot.created_at) : "—"}
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
          {lot.start_date ? formatDateTimeLondon(lot.start_date) : "—"}
        </div>
        <div>
          <span className="text-gray-500">Expiry policy:</span>{" "}
          {policyBadge}
        </div>
        <div>
          <span className="text-gray-500">Expiry date:</span>{" "}
          {lot.expiry_date ? formatDateTimeLondon(lot.expiry_date) : "—"}
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
                          a.lesson_id,
                        )}`}
                      >
                        {a.lesson_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {L?.occurred_at
                        ? formatDateTimeLondon(L.occurred_at)
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
    </Section>
  );
}
