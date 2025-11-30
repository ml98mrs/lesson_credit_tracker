// app/(admin)/admin/students/[studentId]/page.tsx
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Section from "@/components/ui/Section";
import { CreditSnapshot } from "@/components/credit/CreditSnapshot";
import OverdraftActionButtons from "./OverdraftActionButtons";
import { Tier, TierBadge } from "@/components/admin/TierBadge";
import StudentStatusToggle from "@/components/admin/StudentStatusToggle";
import WriteOffRemainingButton from "@/components/admin/WriteOffRemainingButton";
import WriteOffOverdraftButton from "@/components/admin/WriteOffOverdraftButton";
import StudentTeacherAssignments from "./StudentTeacherAssignments";
import StudentTierSelector from "@/components/admin/StudentTierSelector";
import { StudentWarningStrip } from "@/components/admin/StudentWarningStrip";
import {
  StudentPricingSnapshot,
  type StudentTeacherRateRow,
} from "@/components/admin/StudentPricingSnapshot";
import {
  StudentSncHistory,
  type SncHistoryRow,
} from "@/components/admin/StudentSncHistory";
import {
  LotAllocationsTable,
  type AllocationRow,
} from "@/components/credit/LotAllocationsTable";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  formatMinutesAsHours,
  formatDateTimeLondon,
} from "@/lib/formatters";
import { formatLotLabel } from "@/lib/creditLots/labels";
import type { CreditLotSource } from "@/lib/creditLots/types";
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
import type {
  StudentAwardReasonSummary,
  } from "@/lib/types/students";
import { computeStudentSncStatus } from "@/lib/domain/snc";
import { getExpiryPolicyLabel } from "@/lib/domain/expiryPolicy";
import { buildAwardLine } from "@/lib/awardReasons";
import {
  formatDeliveryUiLabel,
  type DeliveryUi,
} from "@/lib/domain/delivery";
import {
  formatStudentStatus,
  mapCreditDeliverySummaryRow,
} from "@/lib/domain/students";
import type { VStudentCreditDeliverySummaryRow } from "@/lib/types/views/student";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  delivery_restriction: DeliveryUi | null;
  days_to_expiry: number | null;
  expiry_within_30d: boolean | null;
};

type StudentSummaryTotals = {
  student_id: string;
  total_granted_min: number;
  total_allocated_min: number;
  total_remaining_min: number;
};

type AwardReasonRow = StudentAwardReasonSummary;

type AwardReasonDbRow = {
  award_reason_code: string;
  granted_award_min: number | null;
  used_award_min: number | null;
  remaining_award_min: number | null;
};

const LOW_THRESHOLD_MIN = 360; // 6 hours generic rule for per-lot highlighting

const formatHours = (h: number | null | undefined) =>
  h == null ? "—" : h.toFixed(2);

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
  const studentStatus: StudentStatus = (student.status ?? "current") as StudentStatus;

  // 🔹 Domain-driven label + badge styling
  const studentStatusLabel = formatStudentStatus(studentStatus);

  const studentStatusClass =
    studentStatus === "current"
      ? "bg-emerald-50 text-emerald-700"
      : studentStatus === "dormant"
      ? "bg-amber-50 text-amber-700"
      : studentStatus === "past"
      ? "bg-rose-50 text-rose-700"
      : "bg-gray-100 text-gray-600";


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

  // Find the overdraft lot (if any) and its minutes (sum of negative balances)
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
      .from("v_lot_allocations_detail")
      .select(
        [
          "id",
          "credit_lot_id",
          "lesson_id",
          "minutes_allocated",
          "created_at",
          "lesson_occurred_at",
          "lesson_duration_min",
          "lesson_delivery",
          "lesson_is_snc",
          "lesson_snc_mode",
          "student_full_name",
          "teacher_full_name",
        ].join(","),
      )
      .in("credit_lot_id", lotIds)
      .returns<AllocationRow[]>();

    if (allocErr) {
      throw new Error(allocErr.message);
    }

    const allocationRows = allocs ?? [];

    allocationsByLot = allocationRows.reduce<Record<string, AllocationRow[]>>(
      (acc, a) => {
        if (!acc[a.credit_lot_id]) acc[a.credit_lot_id] = [];
        acc[a.credit_lot_id].push(a);
        return acc;
      },
      {},
    );
  }

  // --- 8) SNC history -------------------------------------------------------
  type SncHistoryDbRow = {
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

  const sncDbRows: SncHistoryDbRow[] = (sncLessons ?? []) as SncHistoryDbRow[];

  // Domain helper: lifetime SNC status from DB rows
  const sncStatus = computeStudentSncStatus(
    sncDbRows.map((r) => ({ is_charged: r.is_charged })),
  );

  // UI table rows
  const sncRows: SncHistoryRow[] = sncDbRows.map((l) => ({
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

// Raw view row → domain summary via shared helper
const rawDeliveryRow = (deliveryRow ?? null) as
  | VStudentCreditDeliverySummaryRow
  | null;

const deliverySummary = mapCreditDeliverySummaryRow(rawDeliveryRow);

const purchasedMin = deliverySummary.purchasedMin;

const purchasedOnlineMin = deliverySummary.purchasedOnlineMin;
const purchasedF2FMin = deliverySummary.purchasedF2fMin;

const usedOnlineInvoiceMin = deliverySummary.usedOnlineMin;
const usedF2FInvoiceMin = deliverySummary.usedF2fMin;

const remainingOnlineInvoiceMin = deliverySummary.remainingOnlineMin;
const remainingF2FInvoiceMin = deliverySummary.remainingF2fMin;


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

  const awardReasons: AwardReasonRow[] =
    ((awardRows ?? []) as AwardReasonDbRow[]).map((row) => ({
      awardReasonCode: row.award_reason_code,
      grantedAwardMin: row.granted_award_min ?? 0,
      usedAwardMin: row.used_award_min ?? 0,
      remainingAwardMin: row.remaining_award_min ?? 0,
    }));

  // Awarded total = granted - purchased (same as student portal)
  const awardedMin = Math.max(totalGrantedMin - purchasedMin, 0);

  // Use shared award-line helper (snake_case mapping)
  const awardRowsForLines = awardReasons.map((r) => ({
    award_reason_code: r.awardReasonCode,
    granted_award_min: r.grantedAwardMin,
    used_award_min: r.usedAwardMin,
    remaining_award_min: r.remainingAwardMin,
  }));

  const awardLineAwarded = buildAwardLine(awardRowsForLines, "granted");
  const awardLineUsed = buildAwardLine(awardRowsForLines, "used");
  const awardLineRemaining = buildAwardLine(
    awardRowsForLines,
    "remaining",
  );

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

      {/* 2) Credit summary */}
      <div className="mb-6">
        <CreditSnapshot
          purchasedMin={purchasedMin}
          awardedMin={awardedMin}
          usedMin={usedMin}
          remainingMin={remainingMin}
          purchasedOnlineMin={purchasedOnlineMin}
          purchasedF2fMin={purchasedF2FMin}
          usedOnlineMin={usedOnlineInvoiceMin}
          usedF2fMin={usedF2FInvoiceMin}
          remainingOnlineMin={remainingOnlineInvoiceMin}
          remainingF2fMin={remainingF2FInvoiceMin}
          hasBothDeliveries={hasBothInvoiceModes}
          awardedLine={awardLineAwarded}
          usedAwardLine={awardLineUsed}
          remainingAwardLine={awardLineRemaining}
        />
      </div>

      {/* 3) Warning banners */}
      <div className="mb-6">
        <StudentWarningStrip
  lowCreditAny={lowCreditAny}
  showGenericLow={showGenericLow}
  lowCreditDynamic={lowCreditDynamic}
  lowCreditAlertRemainingHours={
    lowCreditAlert?.remaining_hours != null
      ? Number(lowCreditAlert.remaining_hours)
      : null
  }
  lowCreditAlertAvgMonthHours={
    lowCreditAlert?.avg_month_hours != null
      ? Number(lowCreditAlert.avg_month_hours)
      : null
  }
  lowCreditAlertBufferHours={
    lowCreditAlert?.buffer_hours != null
      ? Number(lowCreditAlert.buffer_hours)
      : null
  }
  onlineAlert={onlineAlert}
  f2fAlert={f2fAlert}
  anyPerDeliveryLow={anyPerDeliveryLow}
  hasOverdraft={hasOverdraft}
  overdraftMinutesRemaining={overdraftMinutesRemaining}
  expiringLotsCount={expiringLots.length}
/>

      </div>

      {/* 4) Panel – key student info (tier, status, lifecycle, usage) */}
      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Tier status:</span>
                <TierBadge tier={studentTier} />
              </div>
              <div className="flex items-center gap-2">
  <span className="text-xs text-gray-500">Student status:</span>
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${studentStatusClass}`}
  >
    {studentStatusLabel}
  </span>
</div>

            </div>
            <div className="text-[11px] text-gray-500">
              Last activity:{" "}
              {lastActivityAt ? formatDateTimeLondon(lastActivityAt) : "—"}
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

        {studentStatus === "dormant" && (remainingMin > 0 || hasOverdraft) && (
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {remainingMin > 0 && (
              <WriteOffRemainingButton
                studentId={studentId}
                remainingMinutes={remainingMin}
              />
            )}
            {hasOverdraft && (
              <WriteOffOverdraftButton
                studentId={studentId}
                overdraftMinutes={overdraftMinutesRemaining}
              />
            )}
          </div>
        )}
      </div>

      {/* 5) Panel – teacher-related info */}
      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-3">
          <StudentTeacherAssignments
            studentId={studentId}
            allTeachers={allTeacherOptions}
            assignedTeachers={assignedTeachers}
          />
        </div>

        {assignedTeachers.length > 0 && (
          <StudentPricingSnapshot
            assignedTeachers={assignedTeachers}
            studentTeacherRates={studentTeacherRates}
          />
        )}
      </div>

      {/* 6) Panel – credit / allocation info */}
      <div className="mb-6 rounded-lg border bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold">
          Credit lots &amp; allocations
        </h3>
        <p className="mb-3 text-[11px] text-gray-500">
          Detailed view of each credit lot and how lessons have been allocated
          against it.
        </p>

        {hasOverdraft && (
          <div className="mb-3 flex justify-end">
            <OverdraftActionButtons studentId={studentId} />
          </div>
        )}

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

                const lotAllocations = allocationsByLot[r.credit_lot_id] ?? [];

                return (
                  <React.Fragment key={r.credit_lot_id}>
                    <tr className="border-b">
                      <td className="py-2 pr-4">{label}</td>
                      <td className="py-2 pr-4">
                        {formatDeliveryUiLabel(r.delivery_restriction)}
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
                        <LotAllocationsTable
  allocations={lotAllocations}
  variant="admin"
  lotId={r.credit_lot_id}
/>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7) SNCs – as shared component */}
      <StudentSncHistory
        sncRows={sncRows}
        isLegacyTier={isLegacyTier}
        lifetimeFreeSncs={lifetimeFreeSncs}
        lifetimeChargedSncs={lifetimeChargedSncs}
        hasLifetimeFreeSnc={hasLifetimeFreeSnc}
      />
    </Section>
  );
}
