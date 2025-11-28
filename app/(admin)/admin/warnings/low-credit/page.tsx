// app/(admin)/admin/warnings/low-credit/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  lowCreditAlertsBaseQuery,
  type LowCreditAlertRow,
  getLowCreditStudentsCountByDelivery,
  getAllLowCreditAlertsByDelivery,
  type LowCreditByDeliveryRow,
} from "@/lib/api/admin/lowCredit";

export const dynamic = "force-dynamic";

export default async function LowCreditStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sb = getAdminSupabase();
  const sp = await searchParams;

  const getParam = (key: string): string =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";

  const nameFilter = getParam("q"); // student name search
  const sortRemainingRaw = getParam("sortRemaining"); // "", "asc", "desc" or rubbish

  const sortRemaining: "" | "asc" | "desc" =
    sortRemainingRaw === "asc" || sortRemainingRaw === "desc"
      ? sortRemainingRaw
      : "";

  // 1) Fetch overall low-credit alerts (per student)
  const { data: alerts, error: aErr } = await lowCreditAlertsBaseQuery(sb)
    .eq("is_low_any", true)
    .order("remaining_minutes", { ascending: true });

  if (aErr) {
    throw new Error(aErr.message);
  }

  const overallRows: LowCreditAlertRow[] =
    (alerts ?? []) as unknown as LowCreditAlertRow[];

  // 2) Fetch per-delivery low-credit alerts (across all students)
  const perDeliveryRows: LowCreditByDeliveryRow[] =
    await getAllLowCreditAlertsByDelivery();

  // 3) Counts by delivery for summary text
  const countsByDelivery = await getLowCreditStudentsCountByDelivery();
  const hasAnyPerDeliveryLow =
    countsByDelivery.online > 0 || countsByDelivery.f2f > 0;

  // 4) If absolutely nothing is low anywhere, early return
  if (overallRows.length === 0 && perDeliveryRows.length === 0) {
    return (
      <Section
        title="Low-credit students"
        subtitle="Below your generic or dynamic low-credit thresholds."
      >
        <div className="mb-3 text-xs text-gray-600">
          <p>
            Generic rule: remaining ≤ 6 hours. Dynamic rule: projected buffer
            &lt; 4 hours versus average usage (last 3 months).
          </p>
          <p className="mt-1">
            Currently low by delivery: Online: {countsByDelivery.online} · F2F:{" "}
            {countsByDelivery.f2f}
          </p>
        </div>
        <p className="text-sm text-gray-600">
          No students are currently below the low-credit thresholds.
        </p>
      </Section>
    );
  }

  // 5) Join to students + profiles for names
  const studentIds = Array.from(
    new Set([
      ...overallRows.map((r) => r.student_id),
      ...perDeliveryRows.map((r) => r.studentId),
    ]),
  );

  const { data: studentRows, error: sErr } = await sb
    .from("students")
    .select("id, profile_id, tier, status")
    .in("id", studentIds);

  if (sErr) {
    throw new Error(sErr.message);
  }

  const studentById = new Map<
    string,
    { profile_id: string; tier: string | null; status: string }
  >();
  for (const s of studentRows ?? []) {
    studentById.set(s.id as string, {
      profile_id: s.profile_id as string,
      tier: (s.tier as string | null) ?? null,
      status: (s.status as string) ?? "current",
    });
  }

  const profileIds = Array.from(
    new Set(Array.from(studentById.values()).map((s) => s.profile_id)),
  );

  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", profileIds);

  if (pErr) {
    throw new Error(pErr.message);
  }

  const nameByProfile = new Map<string, string>();
  for (const p of profiles ?? []) {
    const display =
      (p.preferred_name as string | null) ||
      (p.full_name as string) ||
      "—";
    nameByProfile.set(p.id as string, display);
  }

  const readName = (studentId: string): string => {
    const sInfo = studentById.get(studentId);
    const profileId = sInfo?.profile_id;
    return (
      (profileId && nameByProfile.get(profileId)) ||
      studentId.slice(0, 8) + "…"
    );
  };

  // 6) Shape rows for overall table
  let overallItems = overallRows.map((r) => {
    const sInfo = studentById.get(r.student_id);
    return {
      studentId: r.student_id,
      name: readName(r.student_id),
      tier: sInfo?.tier ?? null,
      status: sInfo?.status ?? "current",
      remainingHours: r.remaining_hours ?? null,
      isGenericLow: r.is_generic_low,
      isDynamicLow: r.is_dynamic_low,
    };
  });

  // 7) Shape rows for per-delivery table
  let perDeliveryItems = perDeliveryRows.map((r) => {
    const sInfo = studentById.get(r.studentId);
    return {
      studentId: r.studentId,
      name: readName(r.studentId),
      tier: sInfo?.tier ?? null,
      status: sInfo?.status ?? "current",
      delivery: r.delivery, // 'online' | 'f2f' | null
      remainingHours: r.remainingHours ?? null,
      isGenericLow: r.isGenericLow,
      isDynamicLow: r.isDynamicLow,
    };
  });

  const formatDelivery = (d: "online" | "f2f" | null) =>
    d === "online" ? "Online" : d === "f2f" ? "F2F" : "—";

  // 8) Apply filters (predictive student name)
  const normalize = (s: string) => s.toLowerCase();

  if (nameFilter.trim()) {
    const nf = normalize(nameFilter.trim());
    const byName = (name: string) => normalize(name).includes(nf);

    overallItems = overallItems.filter((it) => byName(it.name));
    perDeliveryItems = perDeliveryItems.filter((it) => byName(it.name));
  }

  // 9) Sort helper with narrowed order type
  const sortByRemaining = <
    T extends { remainingHours: number | null },
  >(
    items: T[],
    order: "" | "asc" | "desc",
  ): T[] => {
    if (order !== "asc" && order !== "desc") return items;

    const sorted = [...items];
    sorted.sort((a, b) => {
      const aVal = a.remainingHours ?? Number.NEGATIVE_INFINITY;
      const bVal = b.remainingHours ?? Number.NEGATIVE_INFINITY;
      if (aVal === bVal) return 0;
      const cmp = aVal < bVal ? -1 : 1;
      return order === "asc" ? cmp : -cmp;
    });
    return sorted;
  };

  overallItems = sortByRemaining(overallItems, sortRemaining);
  perDeliveryItems = sortByRemaining(perDeliveryItems, sortRemaining);

  return (
    <Section
      title="Low-credit students"
      subtitle="Students below the generic 6-hour threshold or the dynamic high-usage buffer rule."
    >
      <div className="mb-3 text-xs text-gray-600">
        <p>
          Generic rule: remaining ≤ 6 hours. Dynamic rule: projected buffer
          &lt; 4 hours versus average usage (last 3 months).
        </p>
        <p className="mt-1">
          Currently low by delivery: Online: {countsByDelivery.online} · F2F:{" "}
          {countsByDelivery.f2f}
        </p>
      </div>

      {/* Filters */}
      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 text-xs"
      >
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">Student</label>
          <input
            name="q"
            defaultValue={nameFilter}
            placeholder="Search by student name…"
            className="h-7 rounded border px-2 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-gray-500">
            Sort by remaining (h)
          </label>
          <select
            name="sortRemaining"
            defaultValue={sortRemaining}
            className="h-7 rounded border px-2 text-xs"
          >
            <option value="">No sort</option>
            <option value="desc">High → low</option>
            <option value="asc">Low → high</option>
          </select>
        </div>

        <button
          type="submit"
          className="h-7 rounded border px-3 text-xs font-medium"
        >
          Apply
        </button>
      </form>

      {/* Overall per-student low-credit table */}
      {overallItems.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold">
            Overall low-credit (all delivery modes)
          </h2>
          <div className="mb-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Remaining (h)</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {overallItems.map((it) => (
                  <tr key={it.studentId} className="border-b">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{it.name}</div>
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-700">
                      {it.tier ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-700">
                      {it.status}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {it.remainingHours != null
                        ? it.remainingHours.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Link
                        href={`/admin/students/${it.studentId}`}
                        className="text-xs underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Per-delivery low-credit table */}
      {perDeliveryItems.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold">
            Low-credit by delivery (invoice-specific)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Delivery</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Remaining (h)</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {perDeliveryItems.map((it) => (
                  <tr
                    key={`${it.studentId}-${it.delivery}`}
                    className="border-b"
                  >
                    <td className="py-2 pr-4">
                      <div className="font-medium">{it.name}</div>
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-700">
                      {formatDelivery(it.delivery)}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-700">
                      {it.tier ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-700">
                      {it.status}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {it.remainingHours != null
                        ? it.remainingHours.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Link
                        href={`/admin/students/${it.studentId}`}
                        className="text-xs underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}
