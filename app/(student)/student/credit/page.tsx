// app/(student)/student/credit/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatMinutesAsHours, formatDateTimeLondon } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type Delivery = "online" | "f2f" | "hybrid";

type CreditLotRow = {
  credit_lot_id: string;
  source_type: string;
  external_ref: string | null;
  minutes_granted: number;
  minutes_allocated: number;
  minutes_remaining: number;
  expiry_date: string | null;
  expiry_policy: string;
  delivery_restriction: Delivery | null;
};

type SearchParams = {
  creditType?: string;
  delivery?: string;
};

const formatDelivery = (d: Delivery | null) => {
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
};

export default async function StudentCreditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await getServerSupabase();

  // 🔹 resolve searchParams (Next 16 passes a Promise)
  const sp = await searchParams;
  const creditType = sp.creditType || "";
  const deliveryFilter = sp.delivery as Delivery | undefined;

  // 1) Logged-in user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new Error("No authenticated student found.");
  }

  // 2) Student row linked to this auth user (via profiles.id)
  const { data: studentRow, error: sErr } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (sErr) {
    throw new Error(sErr.message);
  }

  if (!studentRow) {
    return (
      <Section title="Your credit" subtitle="Purchased and awarded hours.">
        <p className="text-sm text-gray-600">
          No student record is linked to this account yet. Please contact the
          administrator.
        </p>
      </Section>
    );
  }

  const studentId = studentRow.id as string;

  // 3) Fetch this student's credit lots from the view, with filters
  let query = supabase
    .from("v_credit_lot_remaining")
    .select(
      [
        "credit_lot_id",
        "source_type",
        "external_ref",
        "minutes_granted",
        "minutes_allocated",
        "minutes_remaining",
        "expiry_date",
        "expiry_policy",
        "delivery_restriction",
      ].join(","),
    )
    .eq("student_id", studentId);

  if (creditType === "invoice" || creditType === "award") {
    query = query.eq("source_type", creditType);
  }

  if (deliveryFilter === "online" || deliveryFilter === "f2f") {
    query = query.eq("delivery_restriction", deliveryFilter);
  }

  query = query.order("start_date", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as CreditLotRow[];
  const totalRemaining = rows.reduce(
    (sum, r) => sum + (r.minutes_remaining ?? 0),
    0,
  );

  if (rows.length === 0) {
    return (
      <Section
        title="Your credit"
        subtitle="Purchased and awarded hours, plus any expiry information."
      >
        <div className="mb-4 rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Total remaining</div>
          <div className="text-2xl font-semibold">
            {formatMinutesAsHours(totalRemaining)} h
          </div>
        </div>
        <p className="text-sm text-gray-600">
          You don&apos;t have any active credit matching your current filters.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Your credit"
      subtitle="Purchased and awarded hours, plus any expiry information."
    >
      {/* Filters */}
      <form
        className="mb-4 flex flex-wrap gap-3 text-xs"
        method="GET"
      >
        {/* Credit type */}
        <div className="flex flex-col gap-1">
          <label htmlFor="creditType" className="text-gray-600">
            Credit type
          </label>
          <select
            id="creditType"
            name="creditType"
            defaultValue={creditType}
            className="rounded border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="invoice">Invoice credit</option>
            <option value="award">Awarded credit</option>
          </select>
        </div>

        {/* Delivery */}
        <div className="flex flex-col gap-1">
          <label htmlFor="delivery" className="text-gray-600">
            Delivery
          </label>
          <select
            id="delivery"
            name="delivery"
            defaultValue={deliveryFilter ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="online">Online only</option>
            <option value="f2f">F2F only</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded border bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
          >
            Apply filters
          </button>
          <Link
            href="/student/credit"
            className="rounded border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Total */}
      <div className="mb-4 rounded-2xl border p-4">
        <div className="text-xs text-gray-500">Total remaining</div>
        <div className="text-2xl font-semibold">
          {formatMinutesAsHours(totalRemaining)} h
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4">Delivery</th>
              <th className="py-2 pr-4">Granted (h)</th>
              <th className="py-2 pr-4">Used (h)</th>
              <th className="py-2 pr-4">Remaining (h)</th>
              <th className="py-2 pr-4">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.credit_lot_id} className="border-b">
                <td className="py-2 pr-4">
                  {r.source_type === "invoice"
                    ? `Invoice ${r.external_ref ?? ""}`.trim()
                    : r.source_type === "award"
                    ? "Awarded credit"
                    : r.source_type === "overdraft"
                    ? "Overdraft"
                    : r.source_type}
                </td>
                <td className="py-2 pr-4">
                  {formatDelivery(r.delivery_restriction)}
                </td>
                <td className="py-2 pr-4">
                  {formatMinutesAsHours(r.minutes_granted)} h
                </td>
                <td className="py-2 pr-4">
                  {formatMinutesAsHours(r.minutes_allocated)} h
                </td>
                <td className="py-2 pr-4">
                  {formatMinutesAsHours(r.minutes_remaining)} h
                </td>
                <td className="py-2 pr-4">
  {r.expiry_policy === "none" || !r.expiry_date ? (
    "No expiry"
  ) : r.expiry_policy === "advisory" ? (
    <>({formatDateTimeLondon(r.expiry_date)} – purely advisory)</>
  ) : (
    formatDateTimeLondon(r.expiry_date)
  )}
</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
