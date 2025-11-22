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
} from "@/lib/credit-lot-labels";

import SettleOverdraftButton from "./SettleOverdraftButton";
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

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Delivery = "online" | "f2f" | "hybrid";
type ExpiryPolicy = "none" | "fixed" | "rolling" | string;

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
  state: "open" | "closed" | "expired";
  delivery_restriction: Delivery | null;
};

type SncRow = {
  id: string;
  occurred_at: string;
  duration_min: number;
  delivery: Delivery;
  charged: boolean;
};

const LOW_THRESHOLD_MIN = 360; // 6 hours generic rule for per-lot highlighting

const formatDelivery = (d?: Delivery | null) => {
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

const formatHours = (h: number | null | undefined) =>
  h == null ? "—" : h.toFixed(2);

const sum = (arr: LotRow[], fn: (r: LotRow) => number) =>
  arr.reduce((n, r) => n + fn(r), 0);

export default async function AdminStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;   // 👈 await the Promise
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
  const studentStatus = (student.status ?? "current") as
    | "current"
    | "dormant"
    | "past";

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
      ].join(","),
    )
    .eq("student_id", studentId)
    .order("start_date", { ascending: true });

  if (lotsErr) {
    throw new Error(lotsErr.message);
  }

  const rows: LotRow[] = (lots ?? []) as unknown as LotRow[];

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

  // --- 8) SNC status (current month) & history ------------------------------
  const { data: sncStatus } = await sb
    .from("v_student_snc_status_current_month")
    .select("free_sncs, charged_sncs, has_free_snc_used")
    .eq("student_id", studentId)
    .maybeSingle();

  const freeSncs = sncStatus?.free_sncs ?? 0;
  const chargedSncs = sncStatus?.charged_sncs ?? 0;
  const hasFreeSncUsed = sncStatus?.has_free_snc_used ?? false;

  const { data: sncLessons, error: sncErr } = await sb
    .from("lessons")
    .select("id, occurred_at, duration_min, delivery")
    .eq("student_id", studentId)
    .eq("is_snc", true)
    .eq("state", "confirmed")
    .order("occurred_at", { ascending: true });

  if (sncErr) {
    throw new Error(sncErr.message);
  }

  let sncRows: SncRow[] = [];

  if (sncLessons && sncLessons.length > 0) {
    const sncLessonIds = sncLessons.map((l: any) => l.id as string);

    const { data: sncAllocs, error: sncAllocErr } = await sb
      .from("allocations")
      .select("lesson_id, minutes_allocated")
      .in("lesson_id", sncLessonIds);

    if (sncAllocErr) {
      throw new Error(sncAllocErr.message);
    }

    const chargedSet = new Set<string>();
    (sncAllocs ?? []).forEach((a: any) => {
      if ((a.minutes_allocated ?? 0) > 0) {
        chargedSet.add(a.lesson_id as string);
      }
    });

    sncRows = (sncLessons as any[]).map((l) => ({
      id: l.id as string,
      occurred_at: l.occurred_at as string,
      duration_min: l.duration_min as number,
      delivery: l.delivery as Delivery,
      charged: chargedSet.has(l.id as string),
    }));
  }

  // --- 9) Totals & breakdowns -----------------------------------------------
  // --- 9) Totals & breakdowns -----------------------------------------------
const invoiceLots = rows.filter((r) => r.source_type === "invoice");
const awardLots = rows.filter((r) => r.source_type !== "invoice");

const purchasedMin = sum(invoiceLots, (r) => r.minutes_granted);
const awardedMin = sum(awardLots, (r) => r.minutes_granted);

const usedMin = sum(rows, (r) => r.minutes_allocated);
const remainingMin = sum(rows, (r) => r.minutes_remaining);

const purchasedOnlineMin = sum(
  invoiceLots.filter((r) => r.delivery_restriction === "online"),
  (r) => r.minutes_granted,
);
const purchasedF2FMin = sum(
  invoiceLots.filter((r) => r.delivery_restriction === "f2f"),
  (r) => r.minutes_granted,
);

// 👇 define this *before* perDeliveryUsageAvailable
const hasBothInvoiceModes =
  purchasedOnlineMin > 0 && purchasedF2FMin > 0;

const perDeliveryUsageAvailable =
  hasBothInvoiceModes &&
  (onlineAlert?.avgMonthHours != null ||
    f2fAlert?.avgMonthHours != null);

const usedOnlineInvoiceMin = sum(
  invoiceLots.filter((r) => r.delivery_restriction === "online"),
  (r) => r.minutes_allocated,
);
const usedF2FInvoiceMin = sum(
  invoiceLots.filter((r) => r.delivery_restriction === "f2f"),
  (r) => r.minutes_allocated,
);

const remainingOnlineInvoiceMin = sum(
  invoiceLots.filter((r) => r.delivery_restriction === "online"),
  (r) => r.minutes_remaining,
);
const remainingF2FInvoiceMin = sum(
  invoiceLots.filter((r) => r.delivery_restriction === "f2f"),
  (r) => r.minutes_remaining,
);

const awardBuckets = awardLots.reduce<Record<string, number>>(
  (acc, lot) => {
    const reason = lot.award_reason_code ?? "other";
    acc[reason] = (acc[reason] ?? 0) + lot.minutes_granted;
    return acc;
  },
  {},
);

const awardEntries = Object.entries(awardBuckets);
const showAwardBreakdown =
  awardEntries.length > 0 && awardedMin > 0;


  // --- 10) Expiry warnings ---------------------------------------------------
  const today = new Date();
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const expiringLots = rows.filter(
    (r) =>
      r.state === "open" &&
      r.expiry_policy !== "none" &&
      r.expiry_date &&
      new Date(r.expiry_date) <= in30,
  );

  // ---------------------------------------------------------------------------

  return (
    <Section
      title={`Student credit — ${studentName}`}
      subtitle="Hours are shown to two decimal places. Lessons themselves keep minutes."
    >
      {/* Header + Add credit button */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Student</h1>
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
    {avgMonthHours != null ? `${avgMonthHours.toFixed(2)} h / month` : "—"}
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

      {/* Write-off actions (dormant only) */}
      {studentStatus === "dormant" && remainingMin > 0 && (
        <div className="mb-4 flex justify-end">
          <WriteOffRemainingButton
            studentId={studentId}
            remainingMinutes={remainingMin}
          />
        </div>
      )}

      {studentStatus === "dormant" && remainingMin < 0 && (
        <div className="mb-4 flex justify-end">
          <WriteOffOverdraftButton
            studentId={studentId}
            overdraftMinutes={remainingMin}
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
          {showAwardBreakdown && (
            <div className="mt-1 text-xs text-gray-500">
              (
              {awardEntries.map(([code, mins], index) => (
                <span key={code}>
                  {index > 0 && " • "}
                  {formatAwardReason(code)}:{" "}
                  {formatMinutesAsHours(mins)} h
                </span>
              ))}
              )
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
        </div>
      </div>

            {/* Warnings (single block) */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Overall (per-student view) */}
        {lowCreditGeneric && (
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
            Low credit overall (≤ 6h)
          </span>
        )}

        {lowCreditDynamic && (
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
            Buffer &lt; 4h overall — remaining{" "}
            {formatHours(lowCreditAlert?.remaining_hours)} h, avg{" "}
            {formatHours(lowCreditAlert?.avg_month_hours)} h, buffer{" "}
            {formatHours(lowCreditAlert?.buffer_hours)} h
          </span>
        )}

        {/* Per-delivery warnings (from v_student_dynamic_credit_alerts_by_delivery) */}
        {onlineAlert?.isLowAny && (
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
            Low online credit — remaining{" "}
            {formatHours(onlineAlert.remainingHours)} h, avg{" "}
            {formatHours(onlineAlert.avgMonthHours)} h, buffer{" "}
            {formatHours(onlineAlert.bufferHours)} h
          </span>
        )}

        {f2fAlert?.isLowAny && (
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
            Low F2F credit — remaining{" "}
            {formatHours(f2fAlert.remainingHours)} h, avg{" "}
            {formatHours(f2fAlert.avgMonthHours)} h, buffer{" "}
            {formatHours(f2fAlert.bufferHours)} h
          </span>
        )}

        {/* Expiring lots warning (unchanged) */}
        {expiringLots.length > 0 && (
          <span className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-800">
            {expiringLots.length} lot
            {expiringLots.length > 1 ? "s" : ""} expiring ≤ 30 days
          </span>
        )}

        {/* All-clear state */}
        {!lowCreditAny &&
          !anyPerDeliveryLow &&
          expiringLots.length === 0 && (
            <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800">
              All good — no warnings
            </span>
          )}
      </div>


      {/* SNC status (current month) */}
      <div className="mb-6 text-xs text-gray-700">
        <span className="font-medium">
          Short-notice cancellations (this month):{" "}
        </span>
        <span>
          {freeSncs} free · {chargedSncs} charged.{" "}
        </span>
        {hasFreeSncUsed ? (
          <span className="ml-1 text-amber-700">
            Free SNC already used this month.
          </span>
        ) : (
          <span className="ml-1 text-emerald-700">
            Free SNC still available this month.
          </span>
        )}
      </div>

      {/* Negative balance / overdraft */}
      {remainingMin < 0 && (
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-800">
            Negative balance — student owes {-remainingMin} minutes.
          </span>
          <SettleOverdraftButton
            studentId={studentId}
            hasOverdraft={remainingMin < 0}
          />
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
                r.expiry_date &&
                new Date(r.expiry_date) <= in30;

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
                      {formatMinutesAsHours(
                        r.minutes_granted,
                      )}{" "}
                      h
                    </td>
                    <td className="py-2 pr-4">
                      {formatMinutesAsHours(
                        r.minutes_allocated,
                      )}{" "}
                      h
                    </td>
                    <td
                      className={`py-2 pr-4 ${
                        r.minutes_remaining <= LOW_THRESHOLD_MIN
                          ? "text-amber-700"
                          : ""
                      }`}
                    >
                      {formatMinutesAsHours(
                        r.minutes_remaining,
                      )}{" "}
                      h
                    </td>
                    <td className="py-2 pr-4">
                      {r.expiry_policy === "none" || !r.expiry_date ? (
                        ""
                      ) : (
                        <span
                          className={
                            isExpiring ? "text-rose-700" : ""
                          }
                        >
                          {formatDateTimeLondon(r.expiry_date)}
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="border-b">
                    <td
                      colSpan={6}
                      className="bg-gray-50 py-2 pr-4"
                    >
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
