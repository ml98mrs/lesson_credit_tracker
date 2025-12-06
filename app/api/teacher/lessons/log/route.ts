// app/api/teacher/lessons/log/route.ts
import { NextResponse } from "next/server";
import { getTeacherSupabase } from "@/lib/supabase/teacher";
import type { Delivery } from "@/lib/enums";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1) Parse and validate body (shape only)
    const body = await req.json().catch(() => ({}));

    const studentId = body?.studentId as string | undefined;
    const occurredAt = body?.occurredAt as string | undefined; // ISO string
    const durationMin = Number(body?.durationMin);
    const delivery = body?.delivery as Delivery | undefined;
    const isSnc = Boolean(body?.isSnc);
    const notes =
      typeof body?.notes === "string" ? body.notes.trim() : null;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 },
      );
    }

    if (!occurredAt) {
      return NextResponse.json(
        { error: "occurredAt (ISO datetime) is required" },
        { status: 400 },
      );
    }

    if (!delivery || (delivery !== "online" && delivery !== "f2f")) {
      return NextResponse.json(
        { error: "delivery must be 'online' or 'f2f'" },
        { status: 400 },
      );
    }

    // Basic numeric sanity check; business rules live in rpc_log_lesson
    if (Number.isNaN(durationMin) || durationMin <= 0) {
      return NextResponse.json(
        { error: "durationMin must be a positive number of minutes" },
        { status: 400 },
      );
    }

    // 2) Teacher-scoped Supabase client (auth from cookies, handled in helper)
    const supabase = await getTeacherSupabase();

    // 3) Call the RPC (teacher_id + duration rules resolved inside the RPC)
    const { data, error } = await supabase.rpc("rpc_log_lesson", {
      p_student_id: studentId,
      p_occurred_at: occurredAt,
      p_duration_min: durationMin,
      p_delivery: delivery,
      p_is_snc: isSnc,
      p_notes: notes,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    // Expect the RPC to return the inserted lesson row with an `id`
    const lesson = data as { id: string } | null;

    if (!lesson?.id) {
      return NextResponse.json(
        {
          error:
            "Lesson was logged, but no lesson ID was returned from rpc_log_lesson.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, lessonId: lesson.id, lesson },
      { status: 200 },
    );
  } catch (e: unknown) {
    if (e instanceof Error) {
      return NextResponse.json(
        { error: e.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Unknown error" },
      { status: 500 },
    );
  }
}
