import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";

import type { TeacherStatus } from "@/lib/types";   // 👈 NEW
import { SetTeacherPastButton } from "./SetTeacherPastButton";
import { formatMinutesAsHours, formatDateTimeLondon, formatPenniesAsPounds } from "@/lib/formatters";

export const dynamic = "force-dynamic";



type AssignedStudent = {
  id: string;
  name: string;
  status: "current" | "dormant" | "past" | string;
};

type RecentLessonRow = {
  id: string;
  student_id: string;
  start_at: string;
  duration_min: number;
  state: string;
  student_name: string | null;
};

type TeacherMonthStatsRow = {
  lesson_count_total: number | null;
  confirmed_minutes_total: number | null;
  snc_free_count: number | null;
  snc_charged_count: number | null;
};

type TeacherRateSummaryRow = {
  teacher_id: string;
  default_online_rate_pennies: number | null;
  f2f_basic_rate_pennies: number | null;
  f2f_premium_rate_pennies: number | null;
  num_f2f_overrides: number | null;
  min_override_rate_pennies: number | null;
  max_override_rate_pennies: number | null;
};

type TeacherLessonEarningsLastMonthRow = {
  teacher_id: string;
  month_start: string;
  gross_pennies: number | null;
};

type TeacherExpensesSummaryRow = {
  teacher_id: string;
  month_start: string;
  approved_pennies: number | null;
};


export default async function AdminTeacherPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;   // 👈 MUST await params
  if (!teacherId) notFound();

  const sb = getAdminSupabase();

  // ────────────────────────────────────────────────────────────────
  // 1) Core teacher + profile
  // ────────────────────────────────────────────────────────────────
 const { data: teacherRow, error: teacherErr } = await sb
  .from("teachers")
  .select("id, profile_id, created_at, status")  // 👈 added status
  .eq("id", teacherId)
  .maybeSingle();

  if (teacherErr || !teacherRow) {
    notFound();
  }

  const profileId = teacherRow.profile_id as string;

  const { data: profileRow } = await sb
    .from("profiles")
    .select("preferred_name, full_name")
    .eq("id", profileId)
    .maybeSingle();

  const teacherName =
    (profileRow?.preferred_name as string | null) ||
    (profileRow?.full_name as string | null) ||
    "(teacher)";

  
 const teacherStatus = (teacherRow.status as TeacherStatus) ?? "potential";

  // ────────────────────────────────────────────────────────────────
  //2) Rate snapshot (via v_teacher_rate_summary)
  // ────────────────────────────────────────────────────────────────
  const { data: rateRow, error: rateErr } = await sb
    .from("v_teacher_rate_summary")
    .select(
      [
        "teacher_id",
        "default_online_rate_pennies",
        "f2f_basic_rate_pennies",
        "f2f_premium_rate_pennies",
        "num_f2f_overrides",
        "min_override_rate_pennies",
        "max_override_rate_pennies",
      ].join(","),
    )
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (rateErr) {
    console.error("v_teacher_rate_summary error", rateErr.message);
  }

  const rateSummary = (rateRow ?? null) as TeacherRateSummaryRow | null;

  const hasRateSummary =
    rateSummary != null &&
    rateSummary.default_online_rate_pennies != null &&
    rateSummary.f2f_basic_rate_pennies != null &&
    rateSummary.f2f_premium_rate_pennies != null;

  const defaultOnlinePennies =
    rateSummary?.default_online_rate_pennies ?? null;
  const f2fBasicPennies = rateSummary?.f2f_basic_rate_pennies ?? null;
  const f2fPremiumPennies = rateSummary?.f2f_premium_rate_pennies ?? null;
  const numF2fOverrides = rateSummary?.num_f2f_overrides ?? 0;





   // ────────────────────────────────────────────────────────────────
  // 3) Last activity (via view v_teacher_last_activity)
  // ────────────────────────────────────────────────────────────────
  const { data: activityRow, error: activityErr } = await sb
    .from("v_teacher_last_activity")
    .select("last_activity_at")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  const lastActivityAt: string | null =
    activityErr || !activityRow
      ? (teacherRow.created_at as string | null)
      : ((activityRow.last_activity_at as string | null) ??
          (teacherRow.created_at as string | null));

            // ────────────────────────────────────────────────────────────────
  // 4) Usage over last 3 months (via v_teacher_usage_last_3m)
  // ────────────────────────────────────────────────────────────────
  const { data: usageRow, error: usageErr } = await sb
    .from("v_teacher_usage_last_3m")
    .select("avg_month_hours, is_heavy_user")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (usageErr) {
    console.error("v_teacher_usage_last_3m error", usageErr.message);
  }

  const avgMonthHours =
    usageRow && usageRow.avg_month_hours != null
      ? Number(usageRow.avg_month_hours)
      : null;

  const isHeavyUser = usageRow?.is_heavy_user ?? false;

    // ────────────────────────────────────────────────────────────────
  // 5) Last-month lesson stats (via v_teacher_lesson_stats_by_month)
  //    We ask for the previous calendar month in UTC.
  // ────────────────────────────────────────────────────────────────
  const now = new Date();
  const prevMonthStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const prevMonthStartIso = prevMonthStartUtc.toISOString();

  const { data: statsRow, error: statsErr } = await sb
    .from("v_teacher_lesson_stats_by_month")
    .select(
      [
        "lesson_count_total",
        "confirmed_minutes_total",
        "snc_free_count",
        "snc_charged_count",
      ].join(","), // keep it explicit
    )
    .eq("teacher_id", teacherId)
    .eq("month_start", prevMonthStartIso)
    .maybeSingle();

  if (statsErr) {
    console.error("v_teacher_lesson_stats_by_month error", statsErr.message);
  }

  const stats = (statsRow ?? null) as TeacherMonthStatsRow | null;

  const lastMonthLessonCount =
    stats && stats.lesson_count_total != null
      ? Number(stats.lesson_count_total)
      : null;

  const lastMonthMinutesTotal =
    stats && stats.confirmed_minutes_total != null
      ? Number(stats.confirmed_minutes_total)
      : null;

  const lastMonthSncFreeCount =
    stats && stats.snc_free_count != null
      ? Number(stats.snc_free_count)
      : null;

  const lastMonthSncChargedCount =
    stats && stats.snc_charged_count != null
      ? Number(stats.snc_charged_count)
      : null;

  // ────────────────────────────────────────────────────────────────
  // 5b) Last-month money: lesson earnings + approved expenses
  //     (via v_teacher_lesson_earnings_last_month + v_teacher_expenses_summary)
  // ────────────────────────────────────────────────────────────────
  const [
    { data: earningsRow, error: earningsErr },
    { data: expensesSummaryRow, error: expensesSummaryErr },
  ] = await Promise.all([
    sb
      .from("v_teacher_lesson_earnings_last_month")
      .select("teacher_id, month_start, gross_pennies")
      .eq("teacher_id", teacherId)
      .eq("month_start", prevMonthStartIso)
      .maybeSingle(),
    sb
      .from("v_teacher_expenses_summary")
      .select("teacher_id, month_start, approved_pennies")
      .eq("teacher_id", teacherId)
      .eq("month_start", prevMonthStartIso)
      .maybeSingle(),
  ]);

  if (earningsErr) {
    console.error("v_teacher_lesson_earnings_last_month error", earningsErr.message);
  }
  if (expensesSummaryErr) {
    console.error("v_teacher_expenses_summary error", expensesSummaryErr.message);
  }

  const earnings = (earningsRow ?? null) as TeacherLessonEarningsLastMonthRow | null;
  const expensesSummary = (expensesSummaryRow ?? null) as TeacherExpensesSummaryRow | null;

  const lastMonthEarningsPennies =
    earnings && earnings.gross_pennies != null ? Number(earnings.gross_pennies) : null;

  const lastMonthExpensesPennies =
    expensesSummary && expensesSummary.approved_pennies != null
      ? Number(expensesSummary.approved_pennies)
      : null;

  const lastMonthEarningsPounds =
    lastMonthEarningsPennies != null
      ? formatPenniesAsPounds(lastMonthEarningsPennies)
      : null;

  const lastMonthExpensesPounds =
    lastMonthExpensesPennies != null
      ? formatPenniesAsPounds(lastMonthExpensesPennies)
      : null;


  // ────────────────────────────────────────────────────────────────
  // 6) Assigned students (via student_teacher + students + profiles)
  // ────────────────────────────────────────────────────────────────
  const { data: linkRows, error: linkErr } = await sb
    .from("student_teacher")
    .select("student_id")
    .eq("teacher_id", teacherId);

  if (linkErr) {
    throw new Error(linkErr.message);
  }

  const studentIds =
    linkRows?.map((l) => l.student_id as string) ?? [];

  let assignedStudents: AssignedStudent[] = [];

  if (studentIds.length > 0) {
    const { data: studentRows, error: studentsErr } = await sb
      .from("students")
      .select("id, status, profiles(full_name, preferred_name)")
      .in("id", studentIds);

    if (studentsErr) {
      throw new Error(studentsErr.message);
    }

    assignedStudents =
      (studentRows ?? []).map((s: any) => {
        const p = s.profiles;
        const name =
          (p?.preferred_name as string | null) ||
          (p?.full_name as string | null) ||
          "(student)";

        return {
          id: s.id as string,
          name,
          status: (s.status as string) ?? "current",
        };
      }) ?? [];
  }

  // ────────────────────────────────────────────────────────────────
  // 7) Recent lessons (compact table, from v_teacher_lessons)
  // ────────────────────────────────────────────────────────────────
  const { data: recentLessons, error: lessonsErr } = await sb
    .from("v_teacher_lessons")
    .select(
      "id, student_id, start_at, duration_min, state, student_name",
    )
    .eq("teacher_id", teacherId)
    .order("start_at", { ascending: false })
    .limit(10);

  if (lessonsErr) {
    throw new Error(lessonsErr.message);
  }

  const lessonRows: RecentLessonRow[] =
    (recentLessons ?? []) as unknown as RecentLessonRow[];


    const statusLabel =
  teacherStatus === "current"
    ? "Current teacher"
    : teacherStatus === "inactive"
    ? "Inactive (only dormant students)"
    : teacherStatus === "potential"
    ? "Potential (no current/dormant students)"
    : teacherStatus === "past"
    ? "Past teacher"
    : teacherStatus;

const statusClass =
  teacherStatus === "current"
    ? "bg-emerald-50 text-emerald-700"
    : teacherStatus === "inactive"
    ? "bg-amber-50 text-amber-700"
    : teacherStatus === "potential"
    ? "bg-slate-50 text-slate-700"
    : teacherStatus === "past"
    ? "bg-rose-50 text-rose-700"
    : "bg-slate-50 text-slate-700";


 

  // ────────────────────────────────────────────────────────────────

  return (
    <Section title={`Teacher 360 — ${teacherName}`}>
  {/* Header: identity + basic meta */}
<div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <h2 className="text-xl font-semibold tracking-tight text-gray-900">
        {teacherName}
      </h2>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusClass}`}
      >
        {statusLabel}
      </span>
    </div>

    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
      <span>
        Last confirmed lesson:{" "}
        {lastActivityAt
          ? formatDateTimeLondon(lastActivityAt)
          : "No lessons logged yet"}
      </span>

      {avgMonthHours != null && (
        <span className="inline-flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-gray-300" />
          Avg (last 3 months):{" "}
          <span className="font-medium text-gray-700">
            {avgMonthHours} h / month
          </span>
          {isHeavyUser && (
            <span className="ml-1 inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
              Heavy workload
            </span>
          )}
        </span>
      )}
    </div>
  </div>

  <div className="flex flex-col items-end gap-2">
    {/* Quick links */}
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Link
        href={`/admin/teachers/${teacherId}/rates`}
        className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
      >
        Rates
      </Link>
      <Link
        href={`/admin/teachers/${teacherId}/invoices`}
        className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
      >
        Invoices / payouts
      </Link>
    </div>

    {/* Set to past button */}
    <SetTeacherPastButton
      teacherId={teacherId}
      disabled={teacherStatus === "past"}
    />
  </div>
</div>


      

      {/* Workload & usage summary (placeholder numbers for now) */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
        <div>
          Avg usage (last 3 months):{" "}
          {avgMonthHours != null ? `${avgMonthHours} h / month` : "—"}
          {isHeavyUser && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Heavy workload
            </span>
          )}
        </div>
                <div>
          Last month:{" "}
          {lastMonthMinutesTotal != null && lastMonthLessonCount != null ? (
            <>
              {formatMinutesAsHours(lastMonthMinutesTotal)} h across{" "}
              {lastMonthLessonCount} lessons
              {lastMonthSncFreeCount != null &&
                lastMonthSncChargedCount != null && (
                  <>
                    {" "}
                    · SNCs: {lastMonthSncFreeCount} free /{" "}
                    {lastMonthSncChargedCount} student charged 
                  </>
                )}
            </>
          ) : (
            "—"
          )}
        </div>

      </div>


     {/* Money summary (Phase 2 – currently placeholders) */}
<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
    <div className="mb-1 flex items-center justify-between">
      <div className="text-xs font-semibold text-gray-600">
        Lesson earnings (last month)
      </div>
      <span className="h-1 w-8 rounded-full bg-red-500/80" />
    </div>
    <div className="text-xl font-semibold">
      {lastMonthEarningsPounds ?? "—"}
    </div>
    <div className="mt-1 text-[11px] text-gray-500">
      Fully SQL-driven later via v_teacher_lesson_earnings_last_month.
    </div>
  </div>

  <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
    <div className="mb-1 flex items-center justify-between">
      <div className="text-xs font-semibold text-gray-600">
        Expenses (last month)
      </div>
      <span className="h-1 w-8 rounded-full bg-red-500/80" />
    </div>
    <div className="text-xl font-semibold">
      {lastMonthExpensesPounds ?? "—"}
    </div>
    <div className="mt-1 text-[11px] text-gray-500">
      To be driven by v_teacher_expenses_summary.
    </div>
  </div>

  <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
    <div className="mb-1 flex items-center justify-between">
      <div className="text-xs font-semibold text-gray-600">Rates</div>
      <span className="h-1 w-8 rounded-full bg-red-500/80" />
    </div>

    {hasRateSummary ? (
      <div className="mt-1 space-y-1 text-xs">
        <div>
          Online:{" "}
          {defaultOnlinePennies != null
            ? `£${(defaultOnlinePennies / 100).toFixed(2)}/h`
            : "—"}
        </div>
        <div>
          F2F (legacy/basic):{" "}
          {f2fBasicPennies != null
            ? `£${(f2fBasicPennies / 100).toFixed(2)}/h`
            : "—"}
        </div>
        <div>
          F2F (premium/elite):{" "}
          {f2fPremiumPennies != null
            ? `£${(f2fPremiumPennies / 100).toFixed(2)}/h`
            : "—"}
        </div>
        <div className="text-[11px] text-gray-500">
          {numF2fOverrides > 0 ? (
            <>
              {numF2fOverrides} student-specific F2F override
              {numF2fOverrides > 1 ? "s" : ""}.{" "}
              <Link
                href={`/admin/teachers/${teacherId}/rates`}
                className="text-blue-700 underline"
              >
                View details
              </Link>
            </>
          ) : (
            "No student-specific F2F overrides."
          )}
        </div>
      </div>
    ) : (
      <div className="mt-1 text-[11px] text-gray-500">
        No rate row found for this teacher yet. Configure rates on the{" "}
        <Link
          href={`/admin/teachers/${teacherId}/rates`}
          className="text-blue-700 underline"
        >
          Rates
        </Link>{" "}
        page.
      </div>
    )}
  </div>
</div>


      {/* Assigned students */}
      <div className="mb-8">
        <h3 className="mb-2 text-sm font-semibold">Students assigned</h3>
        {assignedStudents.length === 0 ? (
          <p className="text-xs text-gray-600">
            No students are currently linked to this teacher.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {assignedStudents.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 pr-4">{s.name}</td>
                    <td className="py-2 pr-4">
                      {s.status === "current"
                        ? "Current"
                        : s.status === "dormant"
                        ? "Dormant"
                        : s.status === "past"
                        ? "Past"
                        : s.status}
                    </td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="text-[11px] text-blue-700 underline"
                      >
                        View Student 360
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

   {/* Recent lessons */}
<div className="mb-4">
  <h3 className="mb-2 text-sm font-semibold">Recent lessons</h3>
  {lessonRows.length === 0 ? (
    <p className="text-xs text-gray-600">
      No lessons logged yet for this teacher.
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Student</th>
            <th className="py-2 pr-4">Duration (min)</th>
            <th className="py-2 pr-4">State</th>
          </tr>
        </thead>
        <tbody>
          {lessonRows.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-2 pr-4">
                {formatDateTimeLondon(l.start_at)}
              </td>
              <td className="py-2 pr-4">
                {l.student_name ?? "(student)"}
              </td>
              <td className="py-2 pr-4">
                {l.duration_min} min
              </td>
              <td className="py-2 pr-4">
                {l.state === "confirmed" ? "Confirmed" : l.state}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>


    </Section>
  );
}
