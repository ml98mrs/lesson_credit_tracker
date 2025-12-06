// app/(student)/student/dashboard/page.tsx

import Section from "@/components/ui/Section";
import LowCreditBanner from "@/components/banners/LowCreditBanner";
import ExpirySoonBanner from "@/components/banners/ExpirySoonBanner";
import LowCreditByDeliveryBanner from "@/components/banners/LowCreditByDeliveryBanner";
import CreditMeter from "@/components/misc/CreditMeter";
import StudentNotificationPanel, {
  type StudentDashboardNotification,
} from "@/components/student/StudentNotificationPanel";
import { CreditSnapshot } from "@/components/credit/CreditSnapshot";

import { getServerSupabase } from "@/lib/supabase/server";
import { formatStudentDateTime } from "@/lib/formatters";
import { buildAwardLine } from "@/lib/awardReasons";
import { loadStudentDashboard } from "@/lib/api/student/dashboard";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type QueryNotificationRow = {
  id: string;
  admin_note: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};

export default async function StudentDashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Next 16 passes searchParams as a Promise; we don't currently use it
  await searchParams;

  const supabase = await getServerSupabase();

  // 1) Logged-in user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new Error("No authenticated student found.");
  }

  // 2) Student linked to this profile
  const { data: studentRow, error: sErr } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (sErr) throw new Error(sErr.message);

  if (!studentRow) {
    return (
      <Section title="Your credit">
        <p className="text-sm text-gray-600">
          No student record is linked to this account yet. Please contact the
          administrator.
        </p>
      </Section>
    );
  }

  const studentId = studentRow.id as string;

  // 3) Profile timezone (student's local time zone) + full name for greeting
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("timezone, full_name")
    .eq("id", user.id)
    .single();

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  const studentTimeZone = profileRow?.timezone ?? "Europe/London";
  const studentFullName = profileRow?.full_name ?? null;

  // 4) Unseen admin replies for this student (for notifications)
  const { data: qData, error: qErr } = await supabase
    .from("student_record_queries")
    .select("id, admin_note, status, created_at, updated_at")
    .eq("student_id", studentId)
    .not("admin_note", "is", null)
    .is("student_seen_at", null)
    .order("created_at", { ascending: false });

  if (qErr) {
    throw new Error(qErr.message);
  }

  const notifications: StudentDashboardNotification[] =
    ((qData ?? []) as QueryNotificationRow[]).map((q) => ({
      id: q.id,
      title:
        q.status === "resolved"
          ? "Your query has been resolved"
          : "Update on your query",
      body: q.admin_note ?? undefined,
      createdAt: q.updated_at ?? q.created_at,
    }));

  // 5) Load all dashboard data via shared API helper
  const data = await loadStudentDashboard(studentId);

  const {
    grantedMin,
    usedMin,
    remainingMin,
    deliverySummary,
    awardReasons,
    lowCreditAlertsByDelivery,
    nextMandatoryExpiry,
    generatedAtIso,
    lastActivityAtUtc,
  } = data;

  const {
    purchasedMin,
    awardedMin,
    usedMin: usedMinFromDelivery,
    remainingMin: remainingMinFromDelivery,
    purchasedOnlineMin,
    purchasedF2fMin,
    usedOnlineMin,
    usedF2fMin,
    remainingOnlineMin,
    remainingF2fMin,
  } = deliverySummary;

  // Sanity: totals from summary vs delivery summary should match; prefer canonical summary
  const usedTotalMin = usedMin ?? usedMinFromDelivery ?? 0;
  const remainingTotalMin = remainingMin ?? remainingMinFromDelivery ?? 0;

  const hasBothDeliveries = purchasedOnlineMin > 0 && purchasedF2fMin > 0;

  // Student-facing timestamps (in student's local time zone)
  const generatedAtLabel = formatStudentDateTime(
    generatedAtIso,
    studentTimeZone,
  );
  const lastActivityLabel = lastActivityAtUtc
    ? formatStudentDateTime(lastActivityAtUtc, studentTimeZone)
    : null;

  // Prepare award reason lines using shared helper
  const awardRowsForLines = awardReasons.map((r) => ({
    award_reason_code: r.awardReasonCode,
    granted_award_min: r.grantedAwardMin,
    used_award_min: r.usedAwardMin,
    remaining_award_min: r.remainingAwardMin,
  }));

  const awardedLine = buildAwardLine(awardRowsForLines, "granted");
  const usedAwardLine = buildAwardLine(awardRowsForLines, "used");
  const remainingAwardLine = buildAwardLine(awardRowsForLines, "remaining");

  // Per-delivery low-credit alerts for the banner
  const perDeliveryAlerts = lowCreditAlertsByDelivery
    .filter((r) => r.isLowAny)
    .map((r) => ({
      delivery: r.delivery,
      remainingMinutes: r.remainingMinutes,
      avgMonthHours: r.avgMonthHours,
      isGenericLow: r.isGenericLow,
      isDynamicLow: r.isDynamicLow,
    }));

  return (
    <>
      {/* Admin reply notifications */}
      {notifications.length > 0 && (
        <Section title="Updates" subtitle="Recent replies from the admin team.">
          <StudentNotificationPanel initialNotifications={notifications} />
        </Section>
      )}

      {/* Top status + banners */}
      <Section
        title="Overview"
        subtitle="A quick snapshot of your current credit."
      >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Brand-ish status card */}
          <div className="flex-1 rounded-2xl bg-blue-900 px-4 py-3 text-sm text-white shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-blue-100">
                  PS English · Credit portal
                </div>
                {studentFullName && (
                  <div className="mt-1 text-xs text-blue-100/90">
                    Welcome back,{" "}
                    <span className="font-semibold">{studentFullName}</span>
                  </div>
                )}
                <div className="mt-1 text-base font-semibold">
                  Your lesson credit at a glance
                </div>
              </div>
              <div className="rounded-full bg-blue-800 px-3 py-1 text-[11px] font-medium text-blue-100">
                Snapshot as of{" "}
                <span className="font-semibold">{generatedAtLabel}</span>
              </div>
            </div>
            {lastActivityLabel && (
              <div className="mt-2 text-[11px] text-blue-100/90">
                Your most recent confirmed lesson was on{" "}
                <span className="font-semibold">{lastActivityLabel}</span>. Any
                lessons taken since then may not yet be reflected here.
              </div>
            )}
          </div>
        </div>


        {/* Low-credit banners */}
        {!hasBothDeliveries && (
          <LowCreditBanner
            remainingMin={remainingTotalMin}
            generatedAtLabel={generatedAtLabel}
          />
        )}

        {hasBothDeliveries && perDeliveryAlerts.length > 0 && (
          <LowCreditByDeliveryBanner
            alerts={perDeliveryAlerts}
            generatedAtLabel={generatedAtLabel}
          />
        )}

        {/* Only show for mandatory lots with expiry_within_30d = true */}
        <ExpirySoonBanner expiryDateUtc={nextMandatoryExpiry} />
      </Section>

      {/* Snapshot cards (shared component) */}
      <Section
        title="Credit snapshot"
        subtitle="How many hours you’ve purchased, used, and have remaining."
      >
        <CreditSnapshot
          purchasedMin={purchasedMin}
          awardedMin={awardedMin}
          usedMin={usedTotalMin}
          remainingMin={remainingTotalMin}
          purchasedOnlineMin={purchasedOnlineMin}
          purchasedF2fMin={purchasedF2fMin}
          usedOnlineMin={usedOnlineMin}
          usedF2fMin={usedF2fMin}
          remainingOnlineMin={remainingOnlineMin}
          remainingF2fMin={remainingF2fMin}
          hasBothDeliveries={hasBothDeliveries}
          awardedLine={awardedLine}
          usedAwardLine={usedAwardLine}
          remainingAwardLine={remainingAwardLine}
        />
      </Section>

      {/* Visual meter */}
      <Section title="Visual overview">
        <CreditMeter
          grantedMin={grantedMin}
          usedMin={usedTotalMin}
          remainingOnlineMin={remainingOnlineMin}
          remainingF2fMin={remainingF2fMin}
          purchasedOnlineMin={purchasedOnlineMin}
          purchasedF2fMin={purchasedF2fMin}
        />
      </Section>
    </>
  );
}
