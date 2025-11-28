// app/(admin)/admin/warnings/overdraft/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  type ProfilesDisplayEmbed,
  readProfileDisplayName,
} from "@/lib/types/profiles";

export const dynamic = "force-dynamic";

type HazardRow = {
  lesson_id: string;
  allocation_id: string | null;
  hazard_type: string;
  severity: string;
};

type LessonRow = {
  id: string;
  student_id: string;
};

type StudentRow = {
  id: string;
  profiles: ProfilesDisplayEmbed;
};

type HazardWithStudent = HazardRow & {
  studentName: string;
};

function formatSeverity(severity: string): string {
  switch (severity) {
    case "red":
      return "Red";
    case "amber":
      return "Amber";
    case "yellow":
      return "Yellow";
    default:
      return severity || "Unknown";
  }
}

export default async function OverdraftWarningsPage() {
  const sb = getAdminSupabase();

  // 1) Fetch overdraft hazards from v_lesson_hazards
  const { data, error } = await sb
    .from("v_lesson_hazards")
    .select("lesson_id, allocation_id, hazard_type, severity")
    // use the real hazard_type enum value from SQL
    .eq("hazard_type", "overdraft_allocation")
    .order("severity", { ascending: false })
    .order("lesson_id", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as HazardRow[];

  // If no overdraft hazards, early return
  if (rows.length === 0) {
    return (
      <Section
        title="Overdraft / negative balance lessons"
        subtitle="Lessons that were confirmed using overdraft credit (no remaining normal credit). Data source: v_lesson_hazards filtered to overdraft_allocation."
      >
        <p className="text-sm text-slate-600">
          No lessons have used overdraft credit recently 🎉
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Use the Review link to check each lesson’s allocation plan and decide
          whether to keep the overdraft, adjust credit, or write off balances.
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
    .in("id", lessonIds);

  if (lErr) {
    throw new Error(lErr.message);
  }

  const lessonToStudentId = new Map<string, string>();
  const studentIds = new Set<string>();

  for (const l of (lessonRows ?? []) as LessonRow[]) {
    lessonToStudentId.set(l.id, l.student_id);
    studentIds.add(l.student_id);
  }

  // 2b) Fetch students + profiles for names
  const { data: studentRows, error: sErr } = await sb
    .from("students")
    .select("id, profiles(full_name, preferred_name)")
    .in("id", Array.from(studentIds));

  if (sErr) {
    throw new Error(sErr.message);
  }

  const studentIdToName = new Map<string, string>();

  for (const s of (studentRows ?? []) as StudentRow[]) {
    const displayName =
      readProfileDisplayName(s.profiles, undefined) ??
      s.id.slice(0, 8) + "…";
    studentIdToName.set(s.id, displayName);
  }

  // 2c) Enrich hazards with studentName
  const enriched: HazardWithStudent[] = rows.map((r) => {
    const studentId = lessonToStudentId.get(r.lesson_id);
    const studentName =
      (studentId && studentIdToName.get(studentId)) ||
      "Unknown student";

    return {
      ...r,
      studentName,
    };
  });

  return (
    <Section
      title="Overdraft / negative balance lessons"
      subtitle="Lessons that were confirmed using overdraft credit (no remaining normal credit). Data source: v_lesson_hazards filtered to overdraft_allocation."
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Lesson ID</th>
              <th className="py-2 pr-4">Student</th>
              <th className="py-2 pr-4">Allocation ID</th>
              <th className="py-2 pr-4">Severity</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((r, idx) => (
              <tr
                key={`${r.lesson_id}-${r.allocation_id ?? "none"}-${idx}`}
                className="border-b hover:bg-slate-50"
              >
                <td className="py-2 pr-4 font-mono text-xs">
                  {r.lesson_id}
                </td>
                <td className="py-2 pr-4 text-xs">{r.studentName}</td>
                <td className="py-2 pr-4 font-mono text-xs">
                  {r.allocation_id ?? "—"}
                </td>
                <td className="py-2 pr-4">{formatSeverity(r.severity)}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Use the Review link to check each lesson’s allocation plan and decide
        whether to keep the overdraft, adjust credit, or write off balances.
      </p>
    </Section>
  );
}
