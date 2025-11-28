// app/(admin)/admin/analytics/expiry/page.tsx

import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ExpiryRow = {
  month_start: string;
  student_id: string;
  student_name: string | null;
  source_type: string | null;
  expiry_policy: string | null;
  length_restriction: string | null;
  delivery_restriction: string | null;
  tier_restriction: string | null;
  minutes_granted_total: number | null;
  minutes_used_total: number | null;
  minutes_expired_unused: number | null;
};

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function formatPct(numerator: number | null | undefined, denom: number | null | undefined) {
  const num = numerator ?? 0;
  const den = denom ?? 0;
  if (den <= 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function formatMinutes(m: number | null | undefined) {
  return m ?? 0;
}

export default async function ExpiryAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = ((await searchParams) ?? {}) as SearchParams;

  const getParam = (key: string) => {
    const val = sp[key];
    if (Array.isArray(val)) return val[0] ?? "";
    return val ?? "";
  };

  const monthInput = getParam("month"); // "YYYY-MM"
  const studentNameFilter = getParam("studentName");
  const tier = getParam("tier");
  const sourceType = getParam("sourceType");
  const expiryPolicy = getParam("expiryPolicy");

  const monthStart =
    monthInput && monthInput.length === 7 ? `${monthInput}-01` : undefined;

  const supabase = getAdminSupabase();

  let query = supabase
    .from("v_credit_expiry_by_month")
    .select(
      `
      month_start,
      student_id,
      student_name,
      source_type,
      expiry_policy,
      length_restriction,
      delivery_restriction,
      tier_restriction,
      minutes_granted_total,
      minutes_used_total,
      minutes_expired_unused
    `
    );

  if (monthStart) {
    query = query.eq("month_start", monthStart);
  }

  if (studentNameFilter) {
    query = query.ilike("student_name", `%${studentNameFilter}%`);
  }

  if (tier) {
    query = query.eq("tier_restriction", tier);
  }

  if (sourceType) {
    query = query.eq("source_type", sourceType);
  }

  if (expiryPolicy) {
    query = query.eq("expiry_policy", expiryPolicy);
  }

  const { data, error } = await query
    .order("month_start", { ascending: false })
    .order("student_name", { ascending: true })
    .limit(500);

  const rows = (data ?? []) as ExpiryRow[];

  return (
    <Section
      title="Expiry & credit utilisation"
      subtitle="How much credit expires unused, by month, student, lot type, and tier."
    >
      {/* Filters */}
      <form
        method="GET"
        className="mb-4 grid gap-3 rounded-lg border bg-white p-3 text-xs md:grid-cols-4 lg:grid-cols-6"
      >
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Expiry month</label>
          <input
            type="month"
            name="month"
            defaultValue={monthInput}
            className="rounded-md border px-2 py-1"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Student name</label>
          <input
            type="text"
            name="studentName"
            defaultValue={studentNameFilter}
            className="rounded-md border px-2 py-1"
            placeholder="e.g. Mitsubishi"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Tier (restriction)</label>
          <select
            name="tier"
            defaultValue={tier}
            className="rounded-md border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="basic">basic</option>
            <option value="premium">premium</option>
            <option value="elite">elite</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Lot type</label>
          <select
            name="sourceType"
            defaultValue={sourceType}
            className="rounded-md border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="invoice">invoice</option>
            <option value="award">award</option>
            <option value="adjustment">adjustment</option>
            <option value="overdraft">overdraft</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Expiry policy</label>
          <select
            name="expiryPolicy"
            defaultValue={expiryPolicy}
            className="rounded-md border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="none">none</option>
            <option value="mandatory">mandatory</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white"
          >
            Apply
          </button>
          <a
            href="/admin/analytics/expiry"
            className="text-xs text-gray-600 underline"
          >
            Reset
          </a>
        </div>
      </form>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Failed to load expiry stats: {error.message}
        </p>
      )}

      <div className="mb-4 text-xs text-gray-600">
        Each row = <strong>(expiry month, student, lot type, tier restriction)</strong>.
        <br />
        It shows minutes granted vs used vs expired unused for lots that expired
        in that month.
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-gray-50 font-semibold uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Tier restriction</th>
              <th className="px-3 py-2">Lot type</th>
              <th className="px-3 py-2">Expiry policy</th>
              <th className="px-3 py-2">Length cat</th>
              <th className="px-3 py-2">Delivery</th>
              <th className="px-3 py-2">Mins granted</th>
              <th className="px-3 py-2">Mins used</th>
              <th className="px-3 py-2">Mins expired unused</th>
              <th className="px-3 py-2">% expired unused</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-4 text-center text-xs text-gray-500"
                >
                  No expiry data found for this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.month_start}-${row.student_id}-${row.source_type}`}>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.month_start}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.student_name || "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.tier_restriction ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.source_type ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.expiry_policy ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.length_restriction ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.delivery_restriction ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatMinutes(row.minutes_granted_total)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatMinutes(row.minutes_used_total)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatMinutes(row.minutes_expired_unused)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatPct(
                      row.minutes_expired_unused,
                      row.minutes_granted_total,
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
