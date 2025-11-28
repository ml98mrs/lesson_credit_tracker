// app/(student)/student/dashboard/page.tsx

import Section from "@/components/ui/Section";
import LowCreditBanner from "@/components/banners/LowCreditBanner";
import ExpirySoonBanner from "@/components/banners/ExpirySoonBanner";
import LowCreditByDeliveryBanner from "@/components/banners/LowCreditByDeliveryBanner";
import CreditMeter from "@/components/misc/CreditMeter";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatMinutesAsHours, formatStudentDateTime } from "@/lib/formatters";
import { buildAwardLine } from "@/lib/awardReasons";
import { loadStudentDashboard } from "@/lib/api/student/dashboard";
import type { ProfileRow } from "@/lib/types/profiles";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const supabase = await getServerSupabase();

  // Logged-in user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new Error("No authenticated student found.");
  }

  // Student linked to this profile
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

  // Profile timezone (student's local time zone)
  const { data: profileRow, error: profileErr } = await supabase
  .from("profiles")
  .select("timezone")
  .eq("id", user.id)
  .single<Pick<ProfileRow, "timezone">>();

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  const studentTimeZone = profileRow?.timezone ?? "Europe/London";


  // Load all dashboard data via shared API helper
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

  // Hours for display
  const purchasedHours = formatMinutesAsHours(purchasedMin);
  const awardedHours = formatMinutesAsHours(awardedMin);
  const usedHours = formatMinutesAsHours(usedTotalMin);
  const remainingHours = formatMinutesAsHours(remainingTotalMin);

  const purchasedOnlineHours = formatMinutesAsHours(purchasedOnlineMin);
  const purchasedF2fHours = formatMinutesAsHours(purchasedF2fMin);

  const usedOnlineHours = formatMinutesAsHours(usedOnlineMin);
  const usedF2fHours = formatMinutesAsHours(usedF2fMin);

  const remainingOnlineHours = formatMinutesAsHours(remainingOnlineMin);
  const remainingF2fHours = formatMinutesAsHours(remainingF2fMin);

  

  return (
    <>
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

      {/* Snapshot cards */}
      <Section
        title="Credit snapshot"
        subtitle="How many hours you’ve purchased, used, and have remaining."
      >
        <div className="grid gap-4 md:grid-cols-4">
          {/* Purchased */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Purchased
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {purchasedHours} h
            </div>
            {hasBothDeliveries && (
              <div className="mt-1 text-xs text-gray-500">
                Online: {purchasedOnlineHours} h · F2F: {purchasedF2fHours} h
              </div>
            )}
          </div>

          {/* Awarded */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Awarded / bonus
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {awardedHours} h
            </div>
            {awardedLine && (
              <div className="mt-1 text-xs text-gray-500">{awardedLine}</div>
            )}
          </div>

          {/* Used */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Used
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {usedHours} h
            </div>
            {hasBothDeliveries && (
              <div className="mt-1 text-xs text-gray-500">
                Online: {usedOnlineHours} h · F2F: {usedF2fHours} h
              </div>
            )}
            {usedAwardLine && (
              <div className="mt-1 text-xs text-gray-500">
                {usedAwardLine}
              </div>
            )}
          </div>

          {/* Remaining */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Remaining
              </div>
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {remainingHours} h
            </div>
            {hasBothDeliveries && (
              <div className="mt-1 text-xs text-gray-500">
                Online: {remainingOnlineHours} h · F2F: {remainingF2fHours} h
              </div>
            )}
            {remainingAwardLine && (
              <div className="mt-1 text-xs text-gray-500">
                {remainingAwardLine}
              </div>
            )}
          </div>
        </div>
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
