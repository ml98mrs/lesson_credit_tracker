// app/(admin)/admin/students/[studentId]/page.tsx
import React from "react";
import Link from "next/link";
import Section from "@/components/ui/Section";
import { notFound } from "next/navigation";

import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  formatMinutesAsHours,
  formatDateTimeLondon,
} from "@/lib/formatters";
import {
  formatLotLabel,
  CreditLotSource,
} from "@/lib/creditLots/labels";

import OverdraftActionButtons from "./OverdraftActionButtons";
import LotAllocations, {
  AllocationRow,
} from "@/components/admin/LotAllocations";
import { Tier, TierBadge } from "@/components/admin/TierBadge";
import StudentStatusToggle from "@/components/admin/StudentStatusToggle";
import WriteOffRemainingButton from "@/components/admin/WriteOffRemainingButton";
import WriteOffOverdraftButton from "@/components/admin/WriteOffOverdraftButton";
import StudentTeacherAssignments from "./StudentTeacherAssignments";
import StudentTierSelector from "@/components/admin/StudentTierSelector";
import {
  getLowCreditAlertForStudent,
  getLowCreditAlertsByDeliveryForStudent,
  type LowCreditByDeliveryRow,
} from "@/lib/api/admin/lowCredit";
import {
  Delivery,
  ExpiryPolicy,
  StudentStatus,
  CreditLotState,
} from "@/lib/enums";
import type { StudentAwardReasonSummary } from "@/lib/types/students";
import { computeStudentSncStatus } from "@/lib/domain/snc";
import { getExpiryPolicyLabel } from "@/lib/domain/expiry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// DB-level delivery is "online" | "f2f"; UI also uses "hybrid" in some places
type DeliveryUI = Delivery | "hybrid";

type LotRow = {
  credit_lot_id: string;
  source_type: CreditLotSource;
  award_reason_code: string | null;
  external_ref: string | null;
  minutes_granted: number;
  minutes_allocated: number;
  minutes_remaining: number;
  expiry_date: string | null;
  expiry_policy: ExpiryPolicy;
  state: CreditLotState;
  delivery_restriction: DeliveryUI | null;
  days_to_expiry: number | null;
  expiry_within_30d: boolean | null;
};

type SncRow = {
  id: string;
  occurred_at: string;
  duration_min: number;
  delivery: Delivery; // SNC view uses DB enum only
  charged: boolean;
};

type StudentSummaryTotals = {
  student_id: string;
  total_granted_min: number;
  total_allocated_min: number;
  total_remaining_min: number;
};

type StudentCreditDeliverySummary = {
  student_id: string;
  purchased_min: number;
  used_min: number;
  remaining_min: number;
  purchased_online_min: number;
  purchased_f2f_min: number;
  used_online_min: number;
  used_f2f_min: number;
  remaining_online_min: number;
  remaining_f2f_min: number;
};

type AwardReasonRow = StudentAwardReasonSummary;

type AwardReasonDbRow = {
  award_reason_code: string;
  granted_award_min: number | null;
  used_award_min: number | null;
  remaining_award_min: number | null;
};

type StudentTeacherRateRow = {
  student_id: string;
  teacher_id: string;
  student_tier: Tier | null; // matches your Tier type (basic/premium/elite/null)
  effective_online_rate_pennies: number | null;
  effective_f2f_rate_pennies: number | null;
  has_override: boolean;
  f2f_source: string; // 'override' | 'tier_basic' | 'tier_premium' | 'no_rate'
};

const LOW_THRESHOLD_MIN = 360; // 6 hours generic rule for per-lot highlighting

const formatDelivery = (d?: DeliveryUI | null) => {
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

const formatAwardReason = (code: string) => {
  if (!code) return "Other";
  return code
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const buildAwardLine = (
  rows: AwardReasonRow[],
  kind: "granted" | "used" | "remaining",
) => {
  const parts = rows
    .map((r) => {
      const minutes =
        kind === "granted"
          ? r.grantedAwardMin
          : kind === "used"
          ? r.usedAwardMin
          : r.remainingAwardMin;

      if (!minutes || minutes <= 0) return null; // don’t show 0 h

      return `${formatAwardReason(r.awardReasonCode)}: ${formatMinutesAsHours(
        minutes,
      )} h`;
    })
    .filter(Boolean) as string[];

  if (parts.length === 0) return null;
  return `(${parts.join(" • ")})`;
};






const formatHours = (h: number | null | undefined) =>
  h == null ? "—" : h.toFixed(2);

const sum = (arr: LotRow[], fn: (r: LotRow) => number) =>
  arr.reduce((n, r) => n + fn(r), 0);

export default async function AdminStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  if (!studentId) notFound();

  const sb = getAdminSupabase();

  // --- 1) Core student record ------------------------------------------------
  const { data: student, error: sErr } = await sb
    .from("students")
    .select("id, profile_id, created_at, tier, status")
    .eq("id", studentId)
    .single();

  if (sErr || !student) notFound();

  const studentTier: Tier = (student.tier ?? null) as Tier;
  const studentStatus: StudentStatus = (student.status ??
    "current") as StudentStatus;

  // --- 2) Teacher assignments ------------------------------------------------
  const { data: teacherRows, error: tErr } = await sb
    .from("teachers")
    .select("id, profile_id")
    .order("created_at", { ascending: true });

  if (tErr) {
    throw new Error(tErr.message);
  }

  let allTeacherOptions: { id: string; name: string }[] = [];

  if (teacherRows && teacherRows.length > 0) {
    const teacherProfileIds = teacherRows.map((t) => t.profile_id);
    const { data: tProfiles, error: tpErr } = await sb
      .from("profiles")
      .select("id, preferred_name, full_name")
      .in("id", teacherProfileIds);

    if (tpErr) {
      throw new Error(tpErr.message);
    }

    const nameByProfile = new Map(
      (tProfiles ?? []).map((p) => [
        p.id as string,
        ((p.preferred_name as string | null) ||
          (p.full_name as string) ||
          "—") as string,
      ]),
    );

    allTeacherOptions = teacherRows.map((t: any) => ({
      id: t.id as string,
      name:
        nameByProfile.get(t.profile_id as string) ??
        ((t.id as string).slice(0, 8) + "…"),
    }));
  }

  const { data: links, error: linkErr } = await sb
    .from("student_teacher")
    .select("teacher_id")
    .eq("student_id", studentId);

  if (linkErr) {
    throw new Error(linkErr.message);
  }

  const assignedIds = new Set(
    (links ?? []).map((l: any) => l.teacher_id as string),
  );

  const assignedTeachers = allTeacherOptions.filter((t) =>
    assignedIds.has(t.id),
  );

  // --- X) Pricing snapshot: per-teacher rates for this student --------------
  const { data: rateRows, error: rateErr } = await sb
    .from("v_student_teacher_rate_summary")
    .select(
      [
        "student_id",
        "teacher_id",
        "student_tier",
        "effective_online_rate_pennies",
        "effective_f2f_rate_pennies",
        "has_override",
        "f2f_source",
      ].join(","),
    )
    .eq("student_id", studentId);

  if (rateErr) {
    console.error("v_student_teacher_rate_summary error", rateErr.message);
  }

  const studentTeacherRates: StudentTeacherRateRow[] =
    (rateRows ?? []) as unknown as StudentTeacherRateRow[];

  const rateByTeacher = new Map<string, StudentTeacherRateRow>(
    studentTeacherRates.map((r) => [r.teacher_id, r]),
  );

  const formatRatePounds = (pennies: number | null | undefined): string =>
    pennies == null ? "—" : `£${(pennies / 100).toFixed(2)}/h`;

  // --- 3) Last activity (for lifecycle explanations) ------------------------
  const { data: activityRow, error: activityErr } = await sb
    .from("v_student_last_activity")
    .select("last_activity_at")
    .eq("student_id", studentId)
    .maybeSingle();

  const lastActivityAt: string | null =
    activityErr || !activityRow
      ? (student.created_at as string | null)
      : ((activityRow.last_activity_at as string | null) ??
          (student.created_at as string | null));

  // --- 4) Student display name (via profiles) -------------------------------
  const { data: srow } = await sb
    .from("students")
    .select("id, profiles(full_name)")
    .eq("id", studentId)
    .maybeSingle();

  const studentName = (() => {
    const p: any = srow?.profiles;
    if (!p) return "(student)";
    return Array.isArray(p)
      ? p[0]?.full_name ?? "(student)"
      : p.full_name ?? "(student)";
  })();

  // --- 5) Usage over last 3 months ------------------------------------------
  const { data: usageRow, error: usageErr } = await sb
    .from("v_student_usage_last_3m")
    .select("avg_month_hours, is_heavy_user")
    .eq("student_id", studentId)
    .maybeSingle();

  if (usageErr) {
    console.error("v_student_usage_last_3m error", usageErr.message);
  }

  const avgMonthHours =
    usageRow && usageRow.avg_month_hours != null
      ? Number(usageRow.avg_month_hours)
      : null;

  const isHeavyUser = usageRow?.is_heavy_user ?? false;

  // --- 6) Low-credit alert row (generic + dynamic buffer) -------------------
  const lowCreditAlert = await getLowCreditAlertForStudent(studentId);

  const lowCreditGeneric = lowCreditAlert?.is_generic_low ?? false;
  const lowCreditDynamic = lowCreditAlert?.is_dynamic_low ?? false;
  const lowCreditAny =
    lowCreditAlert?.is_low_any ?? lowCreditGeneric;
  const showGenericLow = lowCreditGeneric && !lowCreditDynamic;

  // Per-delivery low-credit alerts (online / F2F)
  const lowCreditByDelivery: LowCreditByDeliveryRow[] =
    await getLowCreditAlertsByDeliveryForStudent(studentId);

  const onlineAlert = lowCreditByDelivery.find(
    (r) => r.delivery === "online",
  );
  const f2fAlert = lowCreditByDelivery.find(
    (r) => r.delivery === "f2f",
  );

  const anyPerDeliveryLow =
    (onlineAlert?.isLowAny ?? false) ||
    (f2fAlert?.isLowAny ?? false);

  // --- 7) Credit lots & allocations -----------------------------------------
  const { data: lots, error: lotsErr } = await sb
    .from("v_credit_lot_remaining")
    .select(
      [
        "credit_lot_id",
        "source_type",
        "award_reason_code",
        "external_ref",
        "minutes_granted",
        "minutes_allocated",
        "minutes_remaining",
        "expiry_date",
        "expiry_policy",
        "state",
        "delivery_restriction",
        "days_to_expiry",
        "expiry_within_30d",
      ].join(","),
    )
    .eq("student_id", studentId)
    .order("start_date", { ascending: true });

  if (lotsErr) {
    throw new Error(lotsErr.message);
  }

  const rows: LotRow[] = (lots ?? []) as unknown as LotRow[];

  // Find the overdraft lot (if any) and its minutes
const overdraftLots = rows.filter(
  (r) => r.source_type === "overdraft" && r.minutes_remaining < 0,
);

const overdraftMinutesRemaining = overdraftLots.reduce(
  (sum, r) => sum + r.minutes_remaining,
  0,
);

const hasOverdraft = overdraftMinutesRemaining < 0;

  const lotIds = rows.map((r) => r.credit_lot_id);
  let allocationsByLot: Record<string, AllocationRow[]> = {};

  if (lotIds.length > 0) {
    const { data: allocs, error: allocErr } = await sb
      .from("allocations")
      .select("id, credit_lot_id, lesson_id, minutes_allocated")
      .in("credit_lot_id", lotIds);

    if (allocErr) {
      throw new Error(allocErr.message);
    }

    const allocationRows: AllocationRow[] = (allocs ?? []) as AllocationRow[];

    allocationsByLot =
      allocationRows.reduce<Record<string, AllocationRow[]>>(
        (acc, a) => {
          if (!acc[a.credit_lot_id]) acc[a.credit_lot_id] = [];
          acc[a.credit_lot_id].push(a);
          return acc;
        },
        {},
      );
  }

  // --- 8) SNC history -------------------------------------------------------
  type SncHistoryRow = {
    lesson_id: string;
    occurred_at: string;
    duration_min: number;
    delivery: Delivery;
    is_charged: boolean;
  };

  const { data: sncLessons, error: sncErr } = await sb
    .from("v_student_snc_lessons")
    .select("lesson_id,occurred_at,duration_min,delivery,is_charged")
    .eq("student_id", studentId)
    .order("occurred_at", { ascending: true });

  if (sncErr) {
    throw new Error(sncErr.message);
  }

  const sncDbRows: SncHistoryRow[] = (sncLessons ?? []) as SncHistoryRow[];

  // Domain helper: lifetime SNC status from DB rows
  const sncStatus = computeStudentSncStatus(
    sncDbRows.map((r) => ({ is_charged: r.is_charged })),
  );

  // UI table rows still use the richer SncRow shape
  const sncRows: SncRow[] = sncDbRows.map((l) => ({
    id: l.lesson_id,
    occurred_at: l.occurred_at,
    duration_min: l.duration_min,
    delivery: l.delivery,
    charged: Boolean(l.is_charged),
  }));

  const lifetimeFreeSncs = sncStatus?.freeSncs ?? 0;
  const lifetimeChargedSncs = sncStatus?.chargedSncs ?? 0;
  const hasLifetimeFreeSnc = sncStatus?.hasFreeSncUsed ?? false;

  // Tier is null for "No package (legacy rules)"
  const isLegacyTier = !studentTier;


  // --- 9) Totals & breakdowns (via views, to stay in sync with student portal) ---

  // 9a) Overall totals
  const { data: summary, error: sumErr } = await sb
    .from("v_student_credit_summary")
    .select(
      "student_id,total_granted_min,total_allocated_min,total_remaining_min",
    )
    .eq("student_id", studentId)
    .maybeSingle();

  if (sumErr) {
    throw new Error(sumErr.message);
  }

  const totals = (summary ?? null) as StudentSummaryTotals | null;

  const totalGrantedMin = totals?.total_granted_min ?? 0;
  const usedMin = totals?.total_allocated_min ?? 0;
  const remainingMin = totals?.total_remaining_min ?? 0;

  // 9b) Per-delivery totals (invoice credit only)
  const { data: deliveryRow, error: deliveryErr } = await sb
    .from("v_student_credit_delivery_summary")
    .select(
      [
        "student_id",
        "purchased_min",
        "used_min",
        "remaining_min",
        "purchased_online_min",
        "purchased_f2f_min",
        "used_online_min",
        "used_f2f_min",
        "remaining_online_min",
        "remaining_f2f_min",
      ].join(","),
    )
    .eq("student_id", studentId)
    .maybeSingle();

  if (deliveryErr) {
    throw new Error(deliveryErr.message);
  }

  const deliverySummary = (deliveryRow ??
    null) as StudentCreditDeliverySummary | null;

  const purchasedMin = deliverySummary?.purchased_min ?? 0;

  const purchasedOnlineMin = deliverySummary?.purchased_online_min ?? 0;
  const purchasedF2FMin = deliverySummary?.purchased_f2f_min ?? 0;

  const usedOnlineInvoiceMin = deliverySummary?.used_online_min ?? 0;
  const usedF2FInvoiceMin = deliverySummary?.used_f2f_min ?? 0;

  const remainingOnlineInvoiceMin =
    deliverySummary?.remaining_online_min ?? 0;
  const remainingF2FInvoiceMin =
    deliverySummary?.remaining_f2f_min ?? 0;

  const hasBothInvoiceModes =
    purchasedOnlineMin > 0 && purchasedF2FMin > 0;

  const perDeliveryUsageAvailable =
    hasBothInvoiceModes &&
    (onlineAlert?.avgMonthHours != null ||
      f2fAlert?.avgMonthHours != null);

  // 9c) Award breakdown by reason (granted minutes)
 const { data: awardRows, error: awardErr } = await sb
  .from("v_student_award_reason_summary")
  .select(
    "award_reason_code,granted_award_min,used_award_min,remaining_award_min",
  )
  .eq("student_id", studentId);

if (awardErr) {
  throw new Error(awardErr.message);
}

const awardReasons: AwardReasonRow[] = ((awardRows ?? []) as AwardReasonDbRow[]).map(
  (row) => ({
    awardReasonCode: row.award_reason_code,
    grantedAwardMin: row.granted_award_min ?? 0,
    usedAwardMin: row.used_award_min ?? 0,
    remainingAwardMin: row.remaining_award_min ?? 0,
  }),
);

// Awarded total = granted - purchased (same as student portal)
const awardedMin = Math.max(totalGrantedMin - purchasedMin, 0);

const awardLineAwarded = buildAwardLine(awardReasons, "granted");
const awardLineUsed = buildAwardLine(awardReasons, "used");
const awardLineRemaining = buildAwardLine(awardReasons, "remaining");


  // --- 10) Expiry warnings (SQL-driven via v_credit_lot_remaining) ----------
  const expiringLots = rows.filter(
    (r) =>
      r.state === "open" &&
      r.expiry_policy !== "none" &&
      (r.expiry_within_30d ?? false),
  );

  // ---------------------------------------------------------------------------

  return (
    <Section title={`Student 360 — ${studentName}`}>
      {/* Header + Add credit button */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/admin/students/${studentId}/credit-lots/new`}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
        >
          + Add credit
        </Link>
      </div>

      {/* Tier, status, lifecycle, usage */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Tier status:</span>
              <TierBadge tier={studentTier} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Student status:</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  studentStatus === "current"
                    ? "bg-emerald-50 text-emerald-700"
                    : studentStatus === "dormant"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {studentStatus === "current"
                  ? "Current"
                  : studentStatus === "dormant"
                  ? "Dormant"
                  : "Past"}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-gray-500">
            Last activity:{" "}
            {lastActivityAt
              ? formatDateTimeLondon(lastActivityAt)
              : "—"}
          </div>
        </div>

        <div className="text-[11px] text-gray-500">
          Avg usage (last 3 months):{" "}
          {avgMonthHours != null
            ? `${avgMonthHours.toFixed(2)} h / month`
            : "—"}
          {isHeavyUser && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Heavy user
            </span>
          )}

          {perDeliveryUsageAvailable && (
            <div className="mt-0.5">
              Online:{" "}
              {onlineAlert?.avgMonthHours != null
                ? `${onlineAlert.avgMonthHours.toFixed(2)} h`
                : "—"}
              {" · "}
              F2F:{" "}
              {f2fAlert?.avgMonthHours != null
                ? `${f2fAlert.avgMonthHours.toFixed(2)} h`
                : "—"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <StudentTierSelector
            studentId={studentId}
            initialTier={studentTier}
          />
          <StudentStatusToggle
            studentId={studentId}
            initialStatus={studentStatus}
            remainingMinutes={remainingMin}
          />
        </div>
      </div>

      {/* Teacher assignments */}
      <div className="mb-6">
        <StudentTeacherAssignments
          studentId={studentId}
          allTeachers={allTeacherOptions}
          assignedTeachers={assignedTeachers}
        />
      </div>

      {/* Pricing snapshot – per-teacher rates for this student */}
      {assignedTeachers.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold">
            Pricing snapshot (per teacher)
          </h3>
          <p className="mb-2 text-[11px] text-gray-500">
            How this student is priced with each assigned teacher. All rates are
            per hour.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Teacher</th>
                  <th className="py-2 pr-4">Online (£/h)</th>
                  <th className="py-2 pr-4">F2F (£/h)</th>
                  <th className="py-2 pr-4">Basis</th>
                </tr>
              </thead>
              <tbody>
                {assignedTeachers.map((t) => {
                  const rate = rateByTeacher.get(t.id);

                  const online = formatRatePounds(
                    rate?.effective_online_rate_pennies,
                  );
                  const f2f = formatRatePounds(
                    rate?.effective_f2f_rate_pennies,
                  );

                  let basis = "No rate configured";
                  if (rate) {
                    if (rate.f2f_source === "override") {
                      basis = "Student-specific F2F override";
                    } else if (rate.f2f_source === "tier_premium") {
                      basis = "Premium/elite tier baseline";
                    } else if (rate.f2f_source === "tier_basic") {
                      basis = "Legacy/basic tier baseline";
                    }
                  }

                  return (
                    <tr key={t.id} className="border-b">
                      <td className="py-2 pr-4">{t.name}</td>
                      <td className="py-2 pr-4">{online}</td>
                      <td className="py-2 pr-4">{f2f}</td>
                      <td className="py-2 pr-4 text-[11px] text-gray-600">
                        {basis}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Write-off actions (dormant only) */}
      {studentStatus === "dormant" && remainingMin > 0 && (
        <div className="mb-4 flex justify-end">
          <WriteOffRemainingButton
            studentId={studentId}
            remainingMinutes={remainingMin}
          />
        </div>
      )}

      {studentStatus === "dormant" && hasOverdraft && (
  <div className="mb-4 flex justify-end">
    <WriteOffOverdraftButton
      studentId={studentId}
      overdraftMinutes={overdraftMinutesRemaining}
    />
  </div>
)}


      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Purchased */}
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Purchased</div>
          <div className="text-2xl font-semibold">
            {formatMinutesAsHours(purchasedMin)} h
          </div>
          {hasBothInvoiceModes && (
            <div className="mt-1 text-xs text-gray-500">
              (Online: {formatMinutesAsHours(purchasedOnlineMin)} h • F2F:{" "}
              {formatMinutesAsHours(purchasedF2FMin)} h)
            </div>
          )}
        </div>

        {/* Awarded */}
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Awarded</div>
          <div className="text-2xl font-semibold">
            {formatMinutesAsHours(awardedMin)} h
          </div>
          {awardLineAwarded && (
            <div className="mt-1 text-xs text-gray-500">
              {awardLineAwarded}
            </div>
          )}
        </div>

        {/* Used */}
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Used</div>
          <div className="text-2xl font-semibold">
            {formatMinutesAsHours(usedMin)} h
          </div>
          {hasBothInvoiceModes && (
            <div className="mt-1 text-xs text-gray-500">
              (Online: {formatMinutesAsHours(usedOnlineInvoiceMin)} h • F2F:{" "}
              {formatMinutesAsHours(usedF2FInvoiceMin)} h)
            </div>
          )}
          {awardLineUsed && (
            <div className="mt-1 text-xs text-gray-500">
              {awardLineUsed}
            </div>
          )}
        </div>

        {/* Remaining */}
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Remaining</div>
          <div
            className={`text-2xl font-semibold ${
              lowCreditAny ? "text-amber-700" : ""
            }`}
          >
            {formatMinutesAsHours(remainingMin)} h
          </div>
          {hasBothInvoiceModes && (
            <div className="mt-1 text-xs text-gray-500">
              (Online: {formatMinutesAsHours(remainingOnlineInvoiceMin)} h •
              F2F: {formatMinutesAsHours(remainingF2FInvoiceMin)} h)
            </div>
          )}
          {awardLineRemaining && (
            <div className="mt-1 text-xs text-gray-500">
              {awardLineRemaining}
            </div>
          )}
        </div>
      </div>

      {/* Warnings (single block) */}
      <div className="mb-6 flex flex-wrap gap-3">
        {/* Overall (per-student view) */}
        {showGenericLow && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
            Low credit overall (≤ 6h)
          </span>
        )}

        {lowCreditDynamic && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
            Buffer &lt; 4h overall — remaining{" "}
            {formatHours(lowCreditAlert?.remaining_hours)} h, avg{" "}
            {formatHours(lowCreditAlert?.avg_month_hours)} h, buffer{" "}
            {formatHours(lowCreditAlert?.buffer_hours)} h
          </span>
        )}

        {/* Per-delivery warnings (from v_student_dynamic_credit_alerts_by_delivery) */}
        {onlineAlert?.isLowAny && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
            Low online credit — remaining{" "}
            {formatHours(onlineAlert.remainingHours)} h, avg{" "}
            {formatHours(onlineAlert.avgMonthHours)} h, buffer{" "}
            {formatHours(onlineAlert.bufferHours)} h
          </span>
        )}

        {f2fAlert?.isLowAny && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
            Low F2F credit — remaining{" "}
            {formatHours(f2fAlert.remainingHours)} h, avg{" "}
            {formatHours(f2fAlert.avgMonthHours)} h, buffer{" "}
            {formatHours(f2fAlert.bufferHours)} h
          </span>
        )}

        {/* Negative balance / overdraft warning */}
        {hasOverdraft && (
          <span className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-800">
            Overdraft in use — student has{" "}
            {formatMinutesAsHours(-overdraftMinutesRemaining)} h in negative
            balance.
          </span>
        )}

        {/* Expiring lots warning */}
        {expiringLots.length > 0 && (
          <span className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-800">
            {expiringLots.length} lot
            {expiringLots.length > 1 ? "s" : ""} expiring ≤ 30 days
          </span>
        )}

        {/* All-clear state */}
        {!lowCreditAny &&
          !anyPerDeliveryLow &&
          expiringLots.length === 0 &&
          !hasOverdraft && (
            <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
              All good — no warnings
            </span>
          )}
      </div>

      {/* SNC status & rules (lifetime view, no "current month") */}
      <div className="mb-6 text-xs text-gray-700">
        <span className="font-medium">
          Short-notice cancellations (to date):{" "}
        </span>
        <span>
          {lifetimeFreeSncs} free · {lifetimeChargedSncs} charged.{" "}
        </span>

        {isLegacyTier ? (
          hasLifetimeFreeSnc ? (
            <span className="ml-1 text-amber-700">
              Lifetime free SNC already used under legacy rules. Any future SNCs
              will be charged (no monthly reset).
            </span>
          ) : (
            <span className="ml-1 text-emerald-700">
              Under legacy rules, the first SNC is free; all later SNCs are
              charged. This student has not yet used their free SNC.
            </span>
          )
        ) : (
          <span className="ml-1 text-gray-700">
            For tiered students (basic/premium/elite), the earliest SNC in each
            calendar month is normally free and any additional SNCs in that
            month are charged. The counts above show this student&apos;s SNC
            history to date.
          </span>
        )}
      </div>

      {/* Negative balance / overdraft actions */}
      {hasOverdraft && (
        <div className="mb-6 flex justify-end">
          <OverdraftActionButtons studentId={studentId} />
        </div>
      )}

      {/* Open lots table + per-lot usage */}
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
            {rows.map((r) => {
              const label = formatLotLabel(
                r.source_type,
                r.external_ref,
                r.award_reason_code,
              );

              const isExpiring =
                r.state === "open" &&
                r.expiry_policy !== "none" &&
                (r.expiry_within_30d ?? false);

              const lotAllocations =
                allocationsByLot[r.credit_lot_id] ?? [];

              return (
                <React.Fragment key={r.credit_lot_id}>
                  <tr className="border-b">
                    <td className="py-2 pr-4">{label}</td>
                    <td className="py-2 pr-4">
                      {formatDelivery(r.delivery_restriction)}
                    </td>
                    <td className="py-2 pr-4">
                      {formatMinutesAsHours(r.minutes_granted)} h
                    </td>
                    <td className="py-2 pr-4">
                      {formatMinutesAsHours(r.minutes_allocated)} h
                    </td>
                    <td
                      className={`py-2 pr-4 ${
                        r.minutes_remaining <= LOW_THRESHOLD_MIN
                          ? "text-amber-700"
                          : ""
                      }`}
                    >
                      {formatMinutesAsHours(r.minutes_remaining)} h
                    </td>
                   <td className="py-2 pr-4">
  {r.expiry_policy === "none" || !r.expiry_date ? (
    ""
  ) : (
    <span className={isExpiring ? "text-rose-700" : ""}>
      {getExpiryPolicyLabel(r.expiry_policy)}{" "}
      {formatDateTimeLondon(r.expiry_date)}
    </span>
  )}
</td>

                  </tr>

                  <tr className="border-b">
                    <td colSpan={6} className="bg-gray-50 py-2 pr-4">
                      <LotAllocations allocations={lotAllocations} />
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SNC history */}
      <div className="mt-10">
        <h2 className="mb-2 text-lg font-semibold">
          Short-notice cancellations
        </h2>

        {sncRows.length === 0 ? (
          <p className="text-sm text-gray-600">
            No short-notice cancellations logged for this student.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Delivery</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Charged?</th>
                </tr>
              </thead>
              <tbody>
                {sncRows.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 pr-4">
                      {formatDateTimeLondon(s.occurred_at)}
                    </td>
                    <td className="py-2 pr-4">
                      {formatDelivery(s.delivery)}
                    </td>
                    <td className="py-2 pr-4">
                      {s.duration_min} min
                    </td>
                    <td className="py-2 pr-4">
                      {s.charged ? (
                        <span className="font-medium text-rose-700">
                          Yes (minutes deducted)
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-700">
                          No (free SNC)
                        </span>
                      )}
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
