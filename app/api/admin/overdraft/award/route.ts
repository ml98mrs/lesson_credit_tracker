// app/api/admin/overdraft/award/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json().catch(() => ({}));

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const body = raw as {
      studentId?: string;
      awardReasonCode?: string;
      note?: string | null;
    };

    const studentId = body.studentId;
    const awardReasonCode = body.awardReasonCode;
    const note = body.note ?? null;

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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
