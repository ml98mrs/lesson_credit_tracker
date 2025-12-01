// app/api/teacher/students/assigned/route.ts
import { NextResponse } from "next/server";
import { getTeacherSupabase } from "@/lib/supabase/teacher";

export const dynamic = "force-dynamic";

// Minimal shape of the joined student + profile rows we care about
type StudentWithProfileRow = {
  id: string;
  status: "current" | "dormant" | "past" | null;
  profiles:
    | null
    | {
        full_name: string | null;
      }
    | {
        full_name: string | null;
      }[];
};

export async function GET() {
  // 1) Teacher-scoped Supabase client (auth from cookies handled in helper)
  const supabase = await getTeacherSupabase();

  // 2) Who is the current user?
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  // 3) Find the teacher row for this profile
  const { data: teacherRow, error: teacherErr } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (teacherErr || !teacherRow) {
    return NextResponse.json(
      { error: "Teacher record not found" },
      { status: 404 },
    );
  }

  const teacherId = teacherRow.id as string;

  // 4) Get student_ids from the linking table
  const { data: linkRows, error: linkErr } = await supabase
    .from("student_teacher")
    .select("student_id")
    .eq("teacher_id", teacherId);

  if (linkErr) {
    return NextResponse.json(
      { error: linkErr.message || "Failed to load assigned students" },
      { status: 500 },
    );
  }

  const studentIds = (linkRows ?? []).map((r) => r.student_id as string);

  if (studentIds.length === 0) {
    return NextResponse.json({ students: [] });
  }

  // 5) Load students + profile names, current + dormant only
  const { data: studentRows, error: studentErr } = await supabase
    .from("students")
    .select("id,status,profiles(full_name)")
    .in("id", studentIds)
    .in("status", ["current", "dormant"]);

  if (studentErr) {
    return NextResponse.json(
      { error: studentErr.message || "Failed to load students" },
      { status: 500 },
    );
  }

  const rows: StudentWithProfileRow[] =
    (studentRows ?? []) as StudentWithProfileRow[];

  const students = rows.map((row) => {
    const profileValue = row.profiles;

    const profile =
      Array.isArray(profileValue) && profileValue.length > 0
        ? profileValue[0]
        : !Array.isArray(profileValue)
          ? profileValue
          : null;

    return {
      id: row.id,
      name: profile?.full_name ?? "(student)",
      status: (row.status ?? "current") as "current" | "dormant" | "past",
    };
  });

  return NextResponse.json({ students });
}
