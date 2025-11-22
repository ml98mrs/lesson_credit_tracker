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

export default async function LowCreditStudentsPage() {
  const sb = getAdminSupabase();

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
            Generic rule: remaining ≤ 6 hours. Dynamic rule: projected buffer &lt;
            4 hours versus average usage (last 3 months).
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

  // 5) Join to students + profiles for names, using union of all studentIds
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
  const overallItems = overallRows.map((r) => {
    const sInfo = studentById.get(r.student_id);
    return {
      studentId: r.student_id,
      name: readName(r.student_id),
      tier: sInfo?.tier ?? null,
      status: sInfo?.status ?? "current",
      remainingHours: r.remaining_hours ?? null,
      avgMonthHours: r.avg_month_hours ?? null,
      bufferHours: r.buffer_hours ?? null,
      isGenericLow: r.is_generic_low,
      isDynamicLow: r.is_dynamic_low,
    };
  });

  // 7) Shape rows for per-delivery table
  const perDeliveryItems = perDeliveryRows.map((r) => {
    const sInfo = studentById.get(r.studentId);
    return {
      studentId: r.studentId,
      name: readName(r.studentId),
      tier: sInfo?.tier ?? null,
      status: sInfo?.status ?? "current",
      delivery: r.delivery, // 'online' | 'f2f' | null
      remainingHours: r.remainingHours ?? null,
      avgMonthHours: r.avgMonthHours ?? null,
      bufferHours: r.bufferHours ?? null,
      isGenericLow: r.isGenericLow,
      isDynamicLow: r.isDynamicLow,
    };
  });

  const formatDelivery = (d: "online" | "f2f" | null) =>
    d === "online" ? "Online" : d === "f2f" ? "F2F" : "—";

  return (
    <Section
      title="Low-credit students"
      subtitle="Students below the generic 6-hour threshold or the dynamic high-usage buffer rule."
    >
      <div className="mb-3 text-xs text-gray-600">
        <p>
          Generic rule: remaining ≤ 6 hours. Dynamic rule: projected buffer &lt;
          4 hours versus average usage (last 3 months).
        </p>
        <p className="mt-1">
          Currently low by delivery: Online: {countsByDelivery.online} · F2F:{" "}
          {countsByDelivery.f2f}
        </p>
      </div>

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
                  <th className="py-2 pr-4">Avg / month (h)</th>
                  <th className="py-2 pr-4">Buffer (h)</th>
                  <th className="py-2 pr-4">Triggers</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {overallItems.map((it) => (
                  <tr key={it.studentId} className="border-b">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {it.studentId}
                      </div>
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
                    <td className="py-2 pr-4 text-xs">
                      {it.avgMonthHours != null
                        ? it.avgMonthHours.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {it.bufferHours != null
                        ? it.bufferHours.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {it.isGenericLow && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                            ≤ 6h
                          </span>
                        )}
                        {it.isDynamicLow && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-800">
                            Buffer &lt; 4h
                          </span>
                        )}
                      </div>
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
                  <th className="py-2 pr-4">Avg / month (h)</th>
                  <th className="py-2 pr-4">Buffer (h)</th>
                  <th className="py-2 pr-4">Triggers</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {perDeliveryItems.map((it) => (
                  <tr key={`${it.studentId}-${it.delivery}`} className="border-b">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {it.studentId}
                      </div>
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
                    <td className="py-2 pr-4 text-xs">
                      {it.avgMonthHours != null
                        ? it.avgMonthHours.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {it.bufferHours != null
                        ? it.bufferHours.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {it.isGenericLow && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                            ≤ 6h
                          </span>
                        )}
                        {it.isDynamicLow && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-800">
                            Buffer &lt; 4h
                          </span>
                        )}
                      </div>
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
