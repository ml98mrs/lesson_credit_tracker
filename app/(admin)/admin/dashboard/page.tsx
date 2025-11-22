// app/(admin)/admin/page.tsx  (or dashboard/page.tsx)
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
  getLowCreditStudentsCountByDelivery,   // 👈 NEW
} from "@/lib/api/admin/lowCredit";
import {
  getTotalRemainingMinutes,
  getStudentLifecycleSummary,
  getExpiringSoonSummary,
  getLastMonthFreeSncPremiumEliteCount,
  getTeacherLifecycleSummary,            // 👈 NEW
} from "@/lib/api/admin/dashboard";



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
    teacherLifecycleSummary,              // 👈 NEW
  ] = await Promise.all([
    getPendingLessonsCount(),
    getLessonHazardsCount(),
    getLowCreditStudentsCount(),
    getTotalRemainingMinutes(),
    getStudentLifecycleSummary(),
    getExpiringSoonSummary(),
    getLastMonthFreeSncPremiumEliteCount(),
    getLowCreditStudentsCountByDelivery(),
    getTeacherLifecycleSummary(),         // 👈 NEW
  ]);

  return {
    pendingLessonsCount,
    lessonHazardsCount,
    todaysSncCount: 0,
    totalRemainingMinutes,
    expiringSoon,
    lowCreditStudentCount,
    lowCreditByDelivery,
    monthlySnc: {
      total: 0,
      free: 0,
      charged: 0,
    },
    freeSncLastMonthPremiumElite,
    sncAnomalyCount: 0,
    lifecycleSummary,
    teacherLifecycleSummary,              // 👈 NEW
    autoDormantCandidateCount: 0,
    writeOffCandidateCount: 0,
  };
}





export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  // Helper: minutes -> hours (UI-only, 2dp)
  const minutesToHours = (minutes: number) =>
    (minutes / 60).toFixed(2);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Admin Dashboard
        </h1>
       
      </header>

      {/* 1. Today / Triage strip */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Today</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <DashboardCard
  title="Pending lessons"
  value={data.pendingLessonsCount}
  description="Waiting for review in the lesson queue."
  actionLabel="View queue"
  href="/admin/lessons/queue" // ← this
/>
          <DashboardCard
  title="Active hazards" // ← was "Lessons with hazards"
  value={data.lessonHazardsCount}
  description="Unresolved hazards from v_lesson_hazards (length, allocation, delivery, etc.)."
  actionLabel="Review hazards"
  href="/admin/hazards"
/>
        <DashboardCard
  title="Low-credit students"
  value={data.lowCreditStudentCount}
  description={`Overall (generic ≤ 6h or dynamic buffer). Online: ${
    data.lowCreditByDelivery?.online ?? 0
  } · F2F: ${data.lowCreditByDelivery?.f2f ?? 0}`}
  actionLabel="View low-credit list"
  href="/admin/students/low-credit"
/>
     
         <DashboardCard
  title="Expiring in next 30 days"
  value={`${data.expiringSoon.mandatory.studentCount} / ${data.expiringSoon.advisory.studentCount}`}
  description={
    `Mandatory: ${minutesToHours(data.expiringSoon.mandatory.totalMinutes)} h · ` +
    `Advisory: ${minutesToHours(data.expiringSoon.advisory.totalMinutes)} h`
  }
  // TODO: link to filtered student list → Student 360
  actionLabel="View expiring credit"
  href="/admin/credit/expiring"  
/>
        
        </div>
      </section>

      <section className="space-y-2">
  <h2 className="text-lg font-semibold">SNC & tiers</h2>
  <div className="grid gap-4 md:grid-cols-3">
    <DashboardCard
  title="SNCs this month"
  value={data.monthlySnc.total}
  description={`Free: ${data.monthlySnc.free} / Charged: ${data.monthlySnc.charged}. Last month free SNCs (premium/elite): ${data.freeSncLastMonthPremiumElite}`}
      actionLabel="free SNCs"
      href="/admin/lessons/cancelled-snc"
     
    />
  </div>
</section>

      {/* 4. Lifecycle & write-offs */}
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
      value={`${data.teacherLifecycleSummary.current} / ${data.teacherLifecycleSummary.potential}`}
      description="Current / Potential teachers."
    />
          <DashboardCard
            title="Auto-dormant candidates"
            value={data.autoDormantCandidateCount}
            description="Matching the auto-dormant rules; review before changing status."
            // TODO: link to maintenance / student index filtered to candidates
            actionLabel="Review candidates"
          />
          
        
          <DashboardCard
            title="Total remaining credit"
            value={`${minutesToHours(data.totalRemainingMinutes)} h`}
            description="Sum of all non-expired credit lots across students."
          />
        </div>
      </section>

      {/* 5. Quick actions */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          {/* TODO: convert to <Link> or buttons that open modals, all via proper /api/admin/... flows */}
          <QuickActionButton label="Add credit (invoice/award)" />
          <QuickActionButton label="Open lesson queue" />
       
          <QuickActionButton label="Maintenance / cleanup" />
        </div>
      </section>
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
  href?: string; // NEW
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
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
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
