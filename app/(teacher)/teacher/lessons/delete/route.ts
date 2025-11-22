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
        { status: 400 }
      );
    }

    const supabase = await getTeacherSupabase();

    // Optionally: ensure the logged-in teacher owns this lesson
    const { data: lessonRow, error: readErr } = await supabase
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .maybeSingle();

    if (readErr || !lessonRow) {
      return NextResponse.json(
        { error: "Lesson not found or not accessible" },
        { status: 404 }
      );
    }

    const { error: delErr } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
