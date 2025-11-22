import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

const BodySchema = z.object({
  studentId: z.string().uuid(),
  teacherId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, teacherId } = parsed.data;
    const sb = getAdminSupabase();

    const { error } = await sb.rpc("rpc_admin_unassign_student_teacher", {
      p_student_id: studentId,
      p_teacher_id: teacherId,
    });

    if (error) {
      console.error("Unassign student->teacher failed", error);
      return NextResponse.json(
        { error: "Failed to unassign teacher", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Unassign student->teacher unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
