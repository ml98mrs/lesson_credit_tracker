// components/admin/StudentPricingSnapshot.tsx
import React from "react";
import type { Tier } from "@/components/admin/TierBadge";

export type StudentTeacherRateRow = {
  student_id: string;
  teacher_id: string;
  student_tier: Tier | null;
  effective_online_rate_pennies: number | null;
  effective_f2f_rate_pennies: number | null;
  has_override: boolean;
  f2f_source: string; // 'override' | 'tier_basic' | 'tier_premium' | 'no_rate'
};

type AssignedTeacher = {
  id: string;
  name: string;
};

type Props = {
  assignedTeachers: AssignedTeacher[];
  studentTeacherRates: StudentTeacherRateRow[];
};

const formatRatePounds = (pennies: number | null | undefined): string =>
  pennies == null ? "—" : `£${(pennies / 100).toFixed(2)}/h`;

export function StudentPricingSnapshot({
  assignedTeachers,
  studentTeacherRates,
}: Props) {
  if (!assignedTeachers.length) return null;

  const rateByTeacher = new Map<string, StudentTeacherRateRow>(
    studentTeacherRates.map((r) => [r.teacher_id, r]),
  );

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-semibold">Pricing snapshot (per teacher)</h3>
      <p className="mb-2 text-[11px] text-gray-500">
        How this student is priced with each assigned teacher. All rates are per hour.
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

              const online = formatRatePounds(rate?.effective_online_rate_pennies);
              const f2f = formatRatePounds(rate?.effective_f2f_rate_pennies);

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
                  <td className="py-2 pr-4 text-[11px] text-gray-600">{basis}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
