// app/(admin)/admin/teachers/[teacherId]/rates/page.tsx

import { notFound } from "next/navigation";
import Section from "@/components/ui/Section";
import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatDateTimeLondon } from "@/lib/formatters";
import TeacherRatesForm from "@/components/admin/TeacherRatesForm";

export const dynamic = "force-dynamic";

type TeacherRateSummaryRow = {
  teacher_id: string;
  default_online_rate_pennies: number | null;
  f2f_basic_rate_pennies: number | null;
  f2f_premium_rate_pennies: number | null;
  num_f2f_overrides: number | null;
  min_override_rate_pennies: number | null;
  max_override_rate_pennies: number | null;
};

type OverrideRow = {
  teacher_id: string;
  student_id: string;
  student_name: string;
  f2f_rate_pennies: number;
};

type AssignedStudentOption = {
  id: string;
  name: string;
};

export default async function TeacherRatesPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  // ✅ Unwrap the Promise
  const { teacherId } = await params;
  if (!teacherId) notFound();

  const sb = getAdminSupabase();

  // 1) Teacher + profile
  const { data: teacherRow, error: teacherErr } = await sb
    .from("teachers")
    .select("id, profile_id, created_at")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherErr || !teacherRow) notFound();

  const { data: profileRow } = await sb
    .from("profiles")
    .select("preferred_name, full_name")
    .eq("id", teacherRow.profile_id as string)
    .maybeSingle();

  const teacherName =
    (profileRow?.preferred_name as string | null) ??
    (profileRow?.full_name as string | null) ??
    "(teacher)";

  // 2) Base rates via v_teacher_rate_summary
  const { data: rateRow, error: rateErr } = await sb
    .from("v_teacher_rate_summary")
    .select(
      [
        "teacher_id",
        "default_online_rate_pennies",
        "f2f_basic_rate_pennies",
        "f2f_premium_rate_pennies",
        "num_f2f_overrides",
        "min_override_rate_pennies",
        "max_override_rate_pennies",
      ].join(","),
    )
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (rateErr) {
    console.error("v_teacher_rate_summary error", rateErr.message);
  }

  const rateSummary = (rateRow ?? null) as TeacherRateSummaryRow | null;

  // 3) Overrides table (join to students + profiles)
  const { data: overrideRows, error: ovErr } = await sb
    .from("teacher_student_f2f_overrides")
    .select(
      `
      teacher_id,
      student_id,
      f2f_rate_pennies,
      students (
        profiles ( preferred_name, full_name )
      )
      `,
    )
    .eq("teacher_id", teacherId);

  if (ovErr) {
    throw new Error(ovErr.message);
  }

  const overrides: OverrideRow[] =
    (overrideRows ?? []).map((row: any) => {
      const studentProfiles = row.students?.profiles;
      let studentName = "(student)";

      if (Array.isArray(studentProfiles) && studentProfiles.length > 0) {
        const p = studentProfiles[0];
        studentName =
          (p.preferred_name as string | null) ??
          (p.full_name as string | null) ??
          "(student)";
      } else if (studentProfiles) {
        const p = studentProfiles;
        studentName =
          (p.preferred_name as string | null) ??
          (p.full_name as string | null) ??
          "(student)";
      }

      return {
        teacher_id: row.teacher_id as string,
        student_id: row.student_id as string,
        student_name: studentName,
        f2f_rate_pennies: row.f2f_rate_pennies as number,
      };
    }) ?? [];

  // 4) Assigned students (for override selection)
  const { data: linkRows, error: linkErr } = await sb
    .from("student_teacher")
    .select("student_id")
    .eq("teacher_id", teacherId);

  if (linkErr) {
    throw new Error(linkErr.message);
  }

  const studentIds = (linkRows ?? []).map((l: any) => l.student_id as string);

  let assignedStudents: AssignedStudentOption[] = [];

  if (studentIds.length > 0) {
    const { data: students, error: studentsErr } = await sb
      .from("students")
      .select("id, profiles(preferred_name, full_name)")
      .in("id", studentIds);

    if (studentsErr) {
      throw new Error(studentsErr.message);
    }

    assignedStudents =
      (students ?? []).map((s: any) => {
        const p = s.profiles;
        const name =
          (p?.preferred_name as string | null) ??
          (p?.full_name as string | null) ??
          "(student)";

        return {
          id: s.id as string,
          name,
        };
      }) ?? [];
  }

  return (
    <Section title={`Teacher rates — ${teacherName}`}>
      <div className="mb-3 text-[11px] text-gray-500">
        Created: {formatDateTimeLondon(teacherRow.created_at as string)}
      </div>

      <div className="mb-4 text-xs">
        <Link
          href={`/admin/teachers/${teacherId}`}
          className="text-blue-700 underline"
        >
          ← Back to Teacher 360
        </Link>
      </div>

      <TeacherRatesForm
        teacherId={teacherId}
        initialRateSummary={rateSummary}
        overrides={overrides}
        assignedStudents={assignedStudents}
      />
    </Section>
  );
}
