// app/(teacher)/teacher/lessons/delete/route.ts
import { NextResponse } from "next/server";
import { getTeacherSupabase } from "@/lib/supabase/teacher";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const lessonId = body?.lessonId as string | undefined;

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId is required" },
        { status: 400 },
      );
    }

    const supabase = await getTeacherSupabase();

    // Resolve current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Map user -> teacher_id
    const { data: teacherRow, error: teacherError } = await supabase
      .from("teachers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (teacherError || !teacherRow?.id) {
      return NextResponse.json(
        { error: "Teacher record not found for this login" },
        { status: 403 },
      );
    }

    const teacherId = teacherRow.id as string;

    // Ensure the logged-in teacher owns this lesson
    const { data: lessonRow, error: readErr } = await supabase
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .eq("teacher_id", teacherId)
      .maybeSingle();

    if (readErr || !lessonRow) {
      return NextResponse.json(
        { error: "Lesson not found or not accessible" },
        { status: 404 },
      );
    }

    const { error: delErr } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId)
      .eq("teacher_id", teacherId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
