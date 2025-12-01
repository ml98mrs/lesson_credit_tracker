// app/(admin)/admin/page.tsx (or dashboard/page.tsx)
//
// Admin Dashboard – read-only + navigation
// - No business logic here (no allocation/SNC/expiry in React)
// - Just calls APIs/views and displays the results

import React from "react";
import Link from "next/link";
import {
  getPendingLessonsCount,
  getLessonHazardsCount,
} from "@/lib/api/admin/lessons";
import {
  getLowCreditStudentsCount,
  getLowCreditStudentsCountByDelivery,
} from "@/lib/api/admin/lowCredit";
import {
  getTotalRemainingMinutes,
  getStudentLifecycleSummary,
  getExpiringSoonSummary,
  getLastMonthFreeSncPremiumEliteCount,
  getTeacherLifecycleSummary,
  getLifecycleNotifications,
  getLastMonthSncSummary, 
  getOpenStudentRecordQueriesCount,
} from "@/lib/api/admin/dashboard";

import {
  NotificationPanel,
  type DashboardNotification,
} from "@/components/admin/NotificationPanel";

import PendingTeacherExpensesCard from "./PendingTeacherExpensesCard";
export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [
    pendingLessonsCount,
    lessonHazardsCount,
    lowCreditStudentCount,
    totalRemainingMinutes,
    lifecycleSummary,
    expiringSoon,
    freeSncLastMonthPremiumElite,
    lowCreditByDelivery,
    teacherLifecycleSummary,
    lifecycleNotifications,
    monthlySncSummary, 
    openStudentQueryCount,
  ] = await Promise.all([
    getPendingLessonsCount(),
    getLessonHazardsCount(),
    getLowCreditStudentsCount(),
    getTotalRemainingMinutes(),
    getStudentLifecycleSummary(),
    getExpiringSoonSummary(),
    getLastMonthFreeSncPremiumEliteCount(),
    getLowCreditStudentsCountByDelivery(),
    getTeacherLifecycleSummary(),
    getLifecycleNotifications(),
    getLastMonthSncSummary(), 
    getOpenStudentRecordQueriesCount(),
  ]);

  return {
    pendingLessonsCount,
    lessonHazardsCount,
    todaysSncCount: 0,
    totalRemainingMinutes,
    expiringSoon,
    lowCreditStudentCount,
    lowCreditByDelivery,
    monthlySnc: monthlySncSummary, 
    freeSncLastMonthPremiumElite,
    sncAnomalyCount: 0,
    lifecycleSummary,
    teacherLifecycleSummary,
    autoDormantCandidateCount: 0,
    writeOffCandidateCount: 0,
    notifications: lifecycleNotifications,
    openStudentQueryCount, 
  };
}


export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  // Helper: minutes -> hours (UI-only, 2dp)
  const minutesToHours = (minutes: number): string =>
    (minutes / 60).toFixed(2);

  const notifications = data.notifications as DashboardNotification[]; // structural match

  return (
  <div className="space-y-8">
    {/* Page header */}
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">
        Admin Dashboard
      </h1>
    </header>

    <main className="space-y-6">
      <NotificationPanel initialNotifications={notifications} />

      {/* Overview & alerts (includes pending expenses card) */}
      <section className="space-y-2">
  <h2 className="text-lg font-semibold">Overview & alerts</h2>
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <PendingTeacherExpensesCard />

    <DashboardCard
      title="Student queries"
      value={data.openStudentQueryCount}
      description="Open queries raised by students about lessons or credit logs."
      actionLabel="Review queries"
      href="/admin/record-queries"
    />

    {/* later: other alert cards can go here */}
  </div>
</section>


      {/* 1. Today / operational KPIs */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Today</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="Pending lessons"
            value={data.pendingLessonsCount}
            description="Waiting for review in the lesson queue."
            actionLabel="View queue"
            href="/admin/lessons/queue"
          />

            <DashboardCard
              title="Active hazards"
              value={data.lessonHazardsCount}
              description="Unresolved hazards from v_lesson_hazards (length, allocation, delivery, etc.)."
              actionLabel="Review hazards"
              href="/admin/warnings/hazards"
            />

            <DashboardCard
              title="Low-credit students"
              value={data.lowCreditStudentCount}
              description={`Overall (generic ≤ 6h or dynamic buffer). Online: ${
                data.lowCreditByDelivery?.online ?? 0
              } · F2F: ${data.lowCreditByDelivery?.f2f ?? 0}`}
              actionLabel="View low-credit list"
              href="/admin/warnings/low-credit"
            />

            <DashboardCard
              title="Expiring in next 30 days"
              value={`${data.expiringSoon.mandatory.studentCount} / ${data.expiringSoon.advisory.studentCount}`}
              description={
                `Mandatory: ${minutesToHours(
                  data.expiringSoon.mandatory.totalMinutes,
                )} h · ` +
                `Advisory: ${minutesToHours(
                  data.expiringSoon.advisory.totalMinutes,
                )} h`
              }
              actionLabel="View expiring credit"
              href="/admin/warnings/credit-expiring"
            />
          </div>
        </section>

       <section className="space-y-2">
  <h2 className="text-lg font-semibold">SNC & tiers</h2>
  <div className="grid gap-4 md:grid-cols-3">
    <DashboardCard
      title="SNCs last month"
      value={data.monthlySnc.total}
      description={
        `Last calendar month (Europe/London). ` +
        `Free: ${data.monthlySnc.free} / Charged: ${data.monthlySnc.charged}. ` +
        `Students on premium/elite with a free SNC last month: ${data.freeSncLastMonthPremiumElite}`
      }
      actionLabel="Review SNCs"
      href="/admin/warnings/cancelled-snc"
    />
  </div>
</section>


        {/* 3. Lifecycle & credit position */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Teachers and Students</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              title="Student lifecycle"
              value={`${data.lifecycleSummary.current} / ${data.lifecycleSummary.dormant} / ${data.lifecycleSummary.past}`}
              description="Current / Dormant / Past students."
            />

            <DashboardCard
              title="Teacher lifecycle"
              value={
                `${data.teacherLifecycleSummary.current} / ` +
                `${data.teacherLifecycleSummary.inactive} / ` +
                `${data.teacherLifecycleSummary.potential} / ` +
                `${data.teacherLifecycleSummary.past}`
              }
              description="Current / Inactive / Potential / Past teachers."
            />

            <DashboardCard
              title="Total remaining credit"
              value={`${minutesToHours(data.totalRemainingMinutes)} h`}
              description="Sum of all non-expired credit lots across students."
            />
          </div>
        </section>

      </main>
    </div>
  );
}

/**
 * Generic dashboard card component.
 * Keeps the layout simple & consistent.
 */
type DashboardCardProps = {
  title: string;
  value: string | number;
  description?: string;
  actionLabel?: string;
  href?: string;
};

function DashboardCard({
  title,
  value,
  description,
  actionLabel,
  href,
}: DashboardCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xl font-semibold">{value}</span>
      </div>

      {description && (
        <p className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {actionLabel && href && (
        <Link
          href={href}
          className="mt-3 inline-flex text-xs font-medium underline-offset-2 hover:underline"
        >
          {actionLabel}
        </Link>
      )}

      {actionLabel && !href && (
        <button
          type="button"
          className="mt-3 text-xs font-medium underline-offset-2 hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Simple quick-action pill/button.
 * These should only navigate or open modals – no direct DB writes.
 */
type QuickActionButtonProps = {
  label: string;
};

function QuickActionButton({ label }: QuickActionButtonProps) {
  return (
    <button
      type="button"
      className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-accent"
    >
      {label}
    </button>
    // Later: attach onClick handlers that navigate or open modals.
  );
}
