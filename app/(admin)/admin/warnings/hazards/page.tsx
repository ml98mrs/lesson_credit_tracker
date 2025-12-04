// app/(admin)/admin/warnings/hazards/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { lessonHazardsBaseQuery } from "@/lib/api/admin/lessons";
import ResolveHazardButton from "./ResolveHazardButton";
import {
  type ProfilesDisplayEmbed,
  readProfileDisplayName,
} from "@/lib/types/profiles";
import type { HazardType } from "@/lib/enums";
import {
  getHazardMeta,
  sortHazardsForDisplay,
} from "@/lib/domain/hazards";

// Basic hazard type from v_lesson_hazards
type Hazard = {
  lesson_id: string;
  allocation_id: string | null;
  hazard_type: HazardType;
  severity: string | null;
};

type LessonRow = {
  id: string;
  student_id: string;
};

type StudentRow = {
  id: string;
  profiles: ProfilesDisplayEmbed;
};

type HazardWithStudent = Hazard & {
  studentName: string;
};

export default async function HazardsPage() {
  const sb = getAdminSupabase();

  // 1) Base hazards from view
  const { data, error } = await lessonHazardsBaseQuery(sb)
    .limit(500)
    .returns<Hazard[]>();

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];

  // If no hazards, early return
  if (rows.length === 0) {
    return (
      <Section
        title="Active hazards"
        subtitle="Unresolved lesson and allocation hazards from v_lesson_hazards."
      >
        <p className="text-sm text-gray-600">No active hazards 🎉</p>
        <p className="mt-3 text-xs text-gray-500">
          Data source: <code>v_lesson_hazards</code>. Use the Review link to
          resolve hazards via the normal lesson flow.
        </p>
      </Section>
    );
  }

  // 2) Resolve lesson → student → profile to get student names

  // 2a) Fetch lessons for these hazards
  const lessonIds = Array.from(new Set(rows.map((r) => r.lesson_id)));

  const { data: lessonRows, error: lErr } = await sb
    .from("lessons")
    .select("id, student_id")
    .in("id", lessonIds)
    .returns<LessonRow[]>();

  if (lErr) {
    throw new Error(lErr.message);
  }

  const lessonToStudentId = new Map<string, string>();
  const studentIds = new Set<string>();

  for (const l of lessonRows ?? []) {
    lessonToStudentId.set(l.id, l.student_id);
    studentIds.add(l.student_id);
  }

  // 2b) Fetch students + profiles for names
  const { data: studentRows, error: sErr } = await sb
    .from("students")
    .select("id, profiles(full_name, preferred_name)")
    .in("id", Array.from(studentIds))
    .returns<StudentRow[]>();

  if (sErr) {
    throw new Error(sErr.message);
  }

  const studentIdToName = new Map<string, string>();

  for (const s of studentRows ?? []) {
    const displayName =
      readProfileDisplayName(s.profiles, undefined) ??
      `${s.id.slice(0, 8)}…`;
    studentIdToName.set(s.id, displayName);
  }

  // 2c) Enrich hazards with studentName
  const enriched: HazardWithStudent[] = rows.map((r) => {
    const studentId = lessonToStudentId.get(r.lesson_id);
    const studentName =
      (studentId && studentIdToName.get(studentId)) ?? "Unknown student";

    return {
      ...r,
      studentName,
    };
  });

  // 2d) Sort hazards using domain ordering (severity + type priority)
  const sorted = sortHazardsForDisplay(enriched);

  return (
    <Section
      title="Active hazards"
      subtitle="Unresolved lesson and allocation hazards from v_lesson_hazards."
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Lesson ID</th>
              <th className="py-2 pr-4">Student</th>
              <th className="py-2 pr-4">Allocation ID</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Severity</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Resolve</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
              const meta = getHazardMeta(r.hazard_type);

              const severityLabel =
                meta.severity === "error"
                  ? "High"
                  : meta.severity === "warning"
                  ? "Medium"
                  : "Low";

              const severityClass =
                meta.severity === "error"
                  ? "bg-rose-100 text-rose-800"
                  : meta.severity === "warning"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-sky-100 text-sky-800";

              return (
                <tr
                  key={`${r.lesson_id}-${r.allocation_id ?? "none"}-${idx}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="py-2 pr-4 font-mono text-xs">
                    {r.lesson_id}
                  </td>
                  <td className="py-2 pr-4 text-xs">{r.studentName}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {r.allocation_id ?? "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="text-xs font-medium">{meta.title}</div>
                    {meta.description && (
                      <div className="text-[11px] text-gray-500">
                        {meta.description}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${severityClass}`}
                    >
                      {severityLabel}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/lessons/review?lessonId=${encodeURIComponent(
                        r.lesson_id,
                      )}`}
                      className="text-blue-700 underline"
                    >
                      Review lesson
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <ResolveHazardButton
                      hazardType={r.hazard_type}
                      lessonId={r.lesson_id}
                      allocationId={r.allocation_id}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Data source: <code>v_lesson_hazards</code>. Use the Review link to
        resolve hazards via the normal lesson flow.
      </p>
    </Section>
  );
}
