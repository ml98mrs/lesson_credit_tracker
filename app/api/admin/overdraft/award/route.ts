// app/api/admin/overdraft/award/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = body?.studentId as string | undefined;
    const awardReasonCode = body?.awardReasonCode as string | undefined;
    const note = (body?.note as string | undefined) ?? null;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 },
      );
    }

    if (!awardReasonCode || !awardReasonCode.trim()) {
      return NextResponse.json(
        { error: "awardReasonCode is required" },
        { status: 400 },
      );
    }

    const sb = getAdminSupabase();

    const { data, error } = await sb.rpc("rpc_award_overdraft", {
      p_student_id: studentId,
      p_award_reason_code: awardReasonCode,
      p_note: note,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to award overdraft" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, result: data ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
