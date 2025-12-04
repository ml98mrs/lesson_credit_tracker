// app/api/admin/overdraft/award/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { OverdraftSettlementResult } from "@/lib/types/credits/overdraft";

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

    const sb = await getAdminSupabase();

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

    // Trust the SQL shape and cast it:
    const result = data as OverdraftSettlementResult;

    // Option A: forward the RPC JSON as-is (recommended)
    return NextResponse.json(result);

    // If you *really* want to keep an outer wrapper, you could do:
    // return NextResponse.json({ ok: true, result } as const);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
