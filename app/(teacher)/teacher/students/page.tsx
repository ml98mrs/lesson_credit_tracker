// app/(teacher)/teacher/students/page.tsx

import { getServerSupabase } from "@/lib/supabase/server";

export default async function Page() {
  const sb = await getServerSupabase();

  // 1) Who is the logged-in teacher?
  const { data: u } = await sb.auth.getUser();
  const user = u?.user;
  if (!user) return <p>Please sign in.</p>;

  const { data: t, error: teacherError } = await sb
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (teacherError || !t?.id) {
    return (
      <p className="text-red-600">
        Error: teacher record not found for this login.
      </p>
    );
  }

  const teacherId = t.id;

  // 2) Assigned students come from student_teacher
  const { data: links, error: linksError } = await sb
    .from("student_teacher")
    .select("student_id")
    .eq("teacher_id", teacherId);

  if (linksError) {
    return (
      <p className="text-red-600">
        Error loading assigned students: {linksError.message}
      </p>
    );
  }

  const studentIds = Array.from(
    new Set((links ?? []).map((r) => r.student_id).filter(Boolean)),
  ) as string[];

  if (studentIds.length === 0) {
    return (
      <div>
        <h1 className="mb-3 text-xl font-semibold">My students</h1>
        <p className="text-gray-600">
          No students assigned yet. Once admin links you to students on the
          Student 360 page, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  // 3) Fetch students + profiles to get a display name
  const { data: students, error: studentsErr } = await sb
    .from("students")
    .select("id, profile_id")
    .in("id", studentIds);

  if (studentsErr) {
    return (
      <p className="text-red-600">
        Error loading students: {studentsErr.message}
      </p>
    );
  }

  const profileIds = Array.from(
    new Set((students ?? []).map((s) => s.profile_id).filter(Boolean)),
  ) as string[];

  const { data: profs, error: profErr } = await sb
    .from("profiles")
    .select("id, preferred_name, full_name")
    .in("id", profileIds);

  if (profErr) {
    return (
      <p className="text-red-600">
        Error loading student names: {profErr.message}
      </p>
    );
  }

  const nameByProfile = new Map(
    (profs ?? []).map((p) => [
      p.id,
      p.preferred_name || p.full_name || "—",
    ]),
  );

  const rows =
    (students ?? []).map((s) => ({
      id: s.id,
      name:
        nameByProfile.get(s.profile_id) ||
        `${(s.id as string).slice(0, 8)}…`,
    })) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My students</h1>
      <ul className="divide-y rounded-xl border bg-white">
        {rows.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between p-4 text-sm"
          >
            <div className="font-medium">{s.name}</div>
            <a
              className="text-xs font-medium text-blue-600 hover:underline"
              href={`/teacher/students/${s.id}`}
            >
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
