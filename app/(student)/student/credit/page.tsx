// app/(student)/student/credit/page.tsx

import React from "react";
import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatExpiryCell } from "@/lib/domain/expiryPolicy";
import type { Delivery } from "@/lib/enums";

import {
  formatMinutesAsHours,
  formatDateTimeLondon,
} from "@/lib/formatters";

import {
  LotAllocationsTable,
  type AllocationRow,
} from "@/components/credit/LotAllocationsTable";
import { formatLotLabel } from "@/lib/creditLots/labels";
import type { CreditLotSource } from "@/lib/creditLots/types";
import {
  creditLotRemainingBaseQuery,
  type CreditLotRemainingRow,
} from "@/lib/api/shared/creditLotsView";
import { formatDeliveryRestrictionLabel } from "@/lib/domain/delivery";
import { loadStudentDashboard } from "@/lib/api/student/dashboard";

export const dynamic = "force-dynamic";

type SearchParams = {
  creditType?: string;
  delivery?: string;
};

export default async function StudentCreditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await getServerSupabase();

  // Next 16: searchParams is a Promise
  const sp = await searchParams;
  const creditType = sp.creditType || "";

  // Narrow delivery filter to allowed values
  const deliveryFilter: Delivery | undefined =
    sp.delivery === "online" || sp.delivery === "f2f"
      ? (sp.delivery as Delivery)
      : undefined;

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

  if (sErr) {
    throw new Error(sErr.message);
  }

  if (!studentRow) {
    return (
      <Section title="Your credit" subtitle="Purchased and awarded hours.">
        <p className="text-sm text-gray-600">
          No student record is linked to this account yet. Please contact the
          administrator.
        </p>
      </Section>
    );
  }

  const studentId = studentRow.id as string;

  // 3) Canonical credit summary (shared with student dashboard)
  const dashboard = await loadStudentDashboard(studentId);
  const totalRemaining = dashboard.remainingMin;

  // 4) Fetch this student's credit lots from the view, with filters
  let lotQuery = creditLotRemainingBaseQuery(supabase).eq(
    "student_id",
    studentId,
  );

  if (creditType === "invoice" || creditType === "award") {
    lotQuery = lotQuery.eq("source_type", creditType as CreditLotSource);
  }

  if (deliveryFilter) {
    lotQuery = lotQuery.eq("delivery_restriction", deliveryFilter);
  }

  lotQuery = lotQuery.order("start_date", { ascending: true });

  const { data: lotData, error: lotErr } =
    await lotQuery.returns<CreditLotRemainingRow[]>();

  if (lotErr) {
    throw new Error(lotErr.message);
  }

  const rows: CreditLotRemainingRow[] = lotData ?? [];

  // 4) Load per-lot allocations (richer detail, shared with admin)
  const lotIds = rows.map((r) => r.credit_lot_id);
  let allocationsByLot: Record<string, AllocationRow[]> = {};

  if (lotIds.length > 0) {
    const { data: allocs, error: allocErr } = await supabase
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

  // 5) If no lots, show a simple summary
  if (rows.length === 0) {
    return (
      <Section
        title="Your credit"
        subtitle="Purchased and awarded hours, plus any expiry information."
      >
        <div className="mb-4 rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Total remaining</div>
          <div className="text-2xl font-semibold">
            {formatMinutesAsHours(totalRemaining)} h
          </div>

          <div className="mt-1 text-[11px] text-gray-500">
            Next mandatory expiry (within 30 days):{" "}
            {dashboard.nextMandatoryExpiry
              ? formatDateTimeLondon(dashboard.nextMandatoryExpiry)
              : "None"}
          </div>
        </div>

        <p className="text-sm text-gray-600">
          You don&apos;t have any active credit matching your current filters.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Your credit"
      subtitle="Purchased and awarded hours, plus any expiry information."
    >
      {/* Summary card */}
      <div className="mb-4 rounded-2xl border p-4">
        <div className="text-xs text-gray-500">Total remaining</div>
        <div className="text-2xl font-semibold">
          {formatMinutesAsHours(totalRemaining)} h
        </div>
      </div>

      {/* Filters */}
      <form className="mb-4 flex flex-wrap gap-3 text-xs" method="GET">
        {/* Credit type */}
        <div className="flex flex-col gap-1">
          <label htmlFor="creditType" className="text-gray-600">
            Credit type
          </label>
          <select
            id="creditType"
            name="creditType"
            defaultValue={creditType}
            className="rounded border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="invoice">Invoice credit</option>
            <option value="award">Awarded credit</option>
          </select>
        </div>

        {/* Delivery */}
        <div className="flex flex-col gap-1">
          <label htmlFor="delivery" className="text-gray-600">
            Delivery
          </label>
          <select
            name="delivery"
            defaultValue={deliveryFilter ?? ""}
            className="rounded-md border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="online">
              {formatDeliveryRestrictionLabel("online")}
            </option>
            <option value="f2f">
              {formatDeliveryRestrictionLabel("f2f")}
            </option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded border bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
          >
            Apply filters
          </button>
          <Link
            href="/student/credit"
            className="rounded border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Lots + per-lot allocations */}
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
              const lotAllocations = allocationsByLot[r.credit_lot_id] ?? [];

              return (
                <React.Fragment key={r.credit_lot_id}>
                  {/* Main lot row */}
                  <tr className="border-b">
                    <td className="py-2 pr-4">
                      {formatLotLabel(
                        r.source_type as CreditLotSource,
                        r.external_ref ?? null,
                        null,
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {r.delivery_restriction
                        ? formatDeliveryRestrictionLabel(
                            r.delivery_restriction,
                          )
                        : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {formatMinutesAsHours(r.minutes_granted ?? 0)} h
                    </td>
                    <td className="py-2 pr-4">
                      {formatMinutesAsHours(r.minutes_allocated ?? 0)} h
                    </td>
                    <td className="py-2 pr-4">
                      {formatMinutesAsHours(r.minutes_remaining ?? 0)} h
                    </td>
                    <td className="py-2 pr-4">
                      {formatExpiryCell(r.expiry_date, r.expiry_policy)}
                    </td>
                  </tr>

                  {/* Per-lot usage (shared with admin, student variant) */}
                  <tr className="border-b">
                    <td colSpan={6} className="bg-gray-50 py-2 pr-4">
                      <LotAllocationsTable
                        allocations={lotAllocations}
                        variant="student"
                      />
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
