// app/(student)/student/dashboard/page.tsx

import Section from "@/components/ui/Section";
import LowCreditBanner from "@/components/banners/LowCreditBanner";
import ExpirySoonBanner from "@/components/banners/ExpirySoonBanner";
import LowCreditByDeliveryBanner from "@/components/banners/LowCreditByDeliveryBanner";
import CreditMeter from "@/components/misc/CreditMeter";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatMinutesAsHours, formatDateTimeLondon } from "@/lib/formatters";

type StudentCreditDeliverySummary = {
  student_id: string;
  purchased_min: number;
  awarded_min: number;
  used_min: number;
  remaining_min: number;
  purchased_online_min: number;
  purchased_f2f_min: number;
  used_online_min: number;
  used_f2f_min: number;
  remaining_online_min: number;
  remaining_f2f_min: number;
};

type AwardReasonRow = {
  award_reason_code: string;
  granted_award_min: number;
  used_award_min: number;
  remaining_award_min: number;
};

type StudentSncStatus = {
  free_sncs: number;
  charged_sncs: number;
  has_free_snc_used: boolean;
};

type RawDeliveryAlertRow = {
  student_id: string;
  delivery: string;
  remaining_minutes: number;
  avg_month_hours: number | null;
  buffer_hours: number | null;
  is_generic_low: boolean;
  is_dynamic_low: boolean;
  is_low_any: boolean;
};

const awardReasonLabels: Record<string, string> = {
  goodwill: "Goodwill",
  trial: "Trial",
  promo: "Promo",
  free_cancellation: "Free cancellation",
};

function buildAwardLine(
  awardRows: AwardReasonRow[],
  kind: "granted" | "used" | "remaining",
): string | null {
  const parts = awardRows
    .map((r) => {
      const label = awardReasonLabels[r.award_reason_code] ?? r.award_reason_code;
      const minutes =
        kind === "granted"
          ? r.granted_award_min
          : kind === "used"
          ? r.used_award_min
          : r.remaining_award_min;

      if (!minutes || minutes <= 0) return null;

      const hours = formatMinutesAsHours(minutes);
      return `${label}: ${hours} h`;
    })
    .filter(Boolean) as string[];

  if (parts.length === 0) return null;
  return `(${parts.join(" • ")})`;
}

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

  // Overall summary (canonical totals)
  const { data: summary, error: sumErr } = await supabase
    .from("v_student_credit_summary")
    .select(
      "student_id,total_granted_min,total_allocated_min,total_remaining_min,next_expiry_date",
    )
    .eq("student_id", studentId)
    .maybeSingle();

  if (sumErr) throw new Error(sumErr.message);

  const granted = summary?.total_granted_min ?? 0;
  const used = summary?.total_allocated_min ?? 0;
  const remaining = summary?.total_remaining_min ?? 0;
 

  const generatedAtIso = new Date().toISOString();
  const generatedAtLabel = formatDateTimeLondon(generatedAtIso);

  // Earliest mandatory expiry within 30 days (for student banner)
const { data: mandatoryExpiryRows, error: mandatoryExpiryErr } =
  await supabase
    .from("v_credit_lot_remaining")
    .select("expiry_date")
    .eq("student_id", studentId)
    .eq("state", "open")
    .eq("expiry_policy", "mandatory")
    .eq("expiry_within_30d", true)
    .order("expiry_date", { ascending: true })
    .limit(1);

if (mandatoryExpiryErr) {
  throw new Error(mandatoryExpiryErr.message);
}

const nextMandatoryExpiry =
  mandatoryExpiryRows && mandatoryExpiryRows.length > 0
    ? (mandatoryExpiryRows[0].expiry_date as string)
    : undefined;

  // SNC status (this calendar month)
  const { data: sncStatusRow, error: sncErr } = await supabase
    .from("v_student_snc_status_current_month")
    .select("free_sncs,charged_sncs,has_free_snc_used")
    .eq("student_id", studentId)
    .maybeSingle();

  if (sncErr) {
    throw new Error(sncErr.message);
  }

  const sncStatus = (sncStatusRow ?? null) as StudentSncStatus | null;
  const freeSncs = sncStatus?.free_sncs ?? 0;
  const chargedSncs = sncStatus?.charged_sncs ?? 0;
  const hasFreeSncUsed = sncStatus?.has_free_snc_used ?? false;
  // (currently not rendered; kept for future SNC widget)

  // Delivery split (from invoice credit lots)
  const { data: deliveryRow, error: deliveryErr } = await supabase
    .from("v_student_credit_delivery_summary")
    .select(
      [
        "student_id",
        "purchased_min",
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

  if (deliveryErr) throw new Error(deliveryErr.message);

  const breakdown = (deliveryRow ??
    {}) as unknown as Partial<StudentCreditDeliverySummary>;

  const purchasedInvoiceMin = breakdown.purchased_min ?? 0;

  // Award reason breakdown
  const { data: awardRows, error: awardErr } = await supabase
    .from("v_student_award_reason_summary")
    .select(
      "award_reason_code,granted_award_min,used_award_min,remaining_award_min",
    )
    .eq("student_id", studentId);

  if (awardErr) throw new Error(awardErr.message);

  const awardReasons = (awardRows ?? []) as unknown as AwardReasonRow[];

  // Totals (in sync with Admin)
  const purchasedMin = purchasedInvoiceMin;
  const awardedMin = Math.max(granted - purchasedMin, 0);
  const usedMin = used;
  const remainingMin = remaining;

  // Delivery split for UI
  const purchasedOnlineMin = breakdown.purchased_online_min ?? 0;
  const purchasedF2fMin = breakdown.purchased_f2f_min ?? 0;

  const usedOnlineMin = breakdown.used_online_min ?? 0;
  const usedF2fMin = breakdown.used_f2f_min ?? 0;

  const remainingOnlineMin = breakdown.remaining_online_min ?? 0;
  const remainingF2fMin = breakdown.remaining_f2f_min ?? 0;

  const hasBothDeliveries =
    purchasedOnlineMin > 0 && purchasedF2fMin > 0;

  // Hours for display
  const purchasedHours = formatMinutesAsHours(purchasedMin);
  const awardedHours = formatMinutesAsHours(awardedMin);
  const usedHours = formatMinutesAsHours(usedMin);
  const remainingHours = formatMinutesAsHours(remainingMin);

  const purchasedOnlineHours = formatMinutesAsHours(purchasedOnlineMin);
  const purchasedF2fHours = formatMinutesAsHours(purchasedF2fMin);

  const usedOnlineHours = formatMinutesAsHours(usedOnlineMin);
  const usedF2fHours = formatMinutesAsHours(usedF2fMin);

  const remainingOnlineHours = formatMinutesAsHours(remainingOnlineMin);
  const remainingF2fHours = formatMinutesAsHours(remainingF2fMin);

  const awardedLine = buildAwardLine(awardReasons, "granted");
  const usedAwardLine = buildAwardLine(awardReasons, "used");
  const remainingAwardLine = buildAwardLine(awardReasons, "remaining");

  // Per-delivery dynamic low-credit alerts
  const { data: alertsRows, error: alertsErr } = await supabase
    .from("v_student_dynamic_credit_alerts_by_delivery")
    .select(
      "student_id,delivery,remaining_minutes,avg_month_hours,buffer_hours,is_generic_low,is_dynamic_low,is_low_any",
    )
    .eq("student_id", studentId);

  if (alertsErr) throw new Error(alertsErr.message);

  const alertRowsTyped = (alertsRows ?? []) as unknown as RawDeliveryAlertRow[];

  const lowAlerts = alertRowsTyped
    .filter((r) => r.is_low_any)
    .map((r) => ({
      delivery: r.delivery,
      remainingMinutes: r.remaining_minutes,
      avgMonthHours: r.avg_month_hours,
      isGenericLow: r.is_generic_low,
      isDynamicLow: r.is_dynamic_low,
    }));

  return (
    <>
   {/* Uni-delivery: overall banner only */}
{!hasBothDeliveries && (
  <LowCreditBanner
    remainingMin={remaining}
    generatedAtLabel={generatedAtLabel}
  />
)}

{/* Bi-delivery: per-delivery banner only */}
{hasBothDeliveries && lowAlerts.length > 0 && (
  <LowCreditByDeliveryBanner
    alerts={lowAlerts}
    generatedAtLabel={generatedAtLabel}
  />
)}

{/* Only show for mandatory lots with expiry_within_30d = true */}
<ExpirySoonBanner expiryDateUtc={nextMandatoryExpiry} />

      <Section title="Your credit">
        <div className="grid gap-4 md:grid-cols-4">
          {/* Purchased */}
          <div className="rounded-2xl border p-4">
            <div className="text-xs text-gray-500">Purchased</div>
            <div className="text-2xl font-semibold">{purchasedHours} h</div>
            {hasBothDeliveries && (
              <div className="mt-1 text-xs text-gray-500">
                (Online: {purchasedOnlineHours} h • F2F: {purchasedF2fHours} h)
              </div>
            )}
          </div>

          {/* Awarded */}
          <div className="rounded-2xl border p-4">
            <div className="text-xs text-gray-500">Awarded</div>
            <div className="text-2xl font-semibold">{awardedHours} h</div>
            {awardedLine && (
              <div className="mt-1 text-xs text-gray-500">{awardedLine}</div>
            )}
          </div>

          {/* Used */}
          <div className="rounded-2xl border p-4">
            <div className="text-xs text-gray-500">Used</div>
            <div className="text-2xl font-semibold">{usedHours} h</div>
            {hasBothDeliveries && (
              <div className="mt-1 text-xs text-gray-500">
                (Online: {usedOnlineHours} h • F2F: {usedF2fHours} h)
              </div>
            )}
            {usedAwardLine && (
              <div className="mt-1 text-xs text-gray-500">{usedAwardLine}</div>
            )}
          </div>

          {/* Remaining */}
          <div className="rounded-2xl border p-4">
            <div className="text-xs text-gray-500">Remaining</div>
            <div className="text-2xl font-semibold">{remainingHours} h</div>
            {hasBothDeliveries && (
              <div className="mt-1 text-xs text-gray-500">
                (Online: {remainingOnlineHours} h • F2F: {remainingF2fHours} h)
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

      <Section title="Visual overview">
        <CreditMeter
          grantedMin={granted}
          usedMin={used}
          remainingOnlineMin={remainingOnlineMin}
          remainingF2fMin={remainingF2fMin}
          purchasedOnlineMin={purchasedOnlineMin}
          purchasedF2fMin={purchasedF2fMin}
        />
      </Section>
    </>
  );
}
