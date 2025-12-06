// app/api/admin/overdraft/award/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { OverdraftSettlementResult } from "@/lib/types/credits/overdraft";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type AwardOverdraftArgs =
  Database["public"]["Functions"]["rpc_award_overdraft"]["Args"];

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
    const awardReasonCode = body.awardReasonCode?.trim();
    const note = body.note;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 },
      );
    }

    if (!awardReasonCode) {
      return NextResponse.json(
        { error: "awardReasonCode is required" },
        { status: 400 },
      );
    }

    const sb = getAdminSupabase();

    const args: AwardOverdraftArgs = {
      p_student_id: studentId,
      p_award_reason_code: awardReasonCode,
    };

    // Generated types usually have p_note as string | undefined.
    // The SQL function treats NULL as "no note", so omitting the arg
    // is equivalent to passing NULL.
    if (note !== null && note !== undefined && note.trim() !== "") {
      args.p_note = note;
    }

    const { data, error } = await sb.rpc("rpc_award_overdraft", args);

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to award overdraft" },
        { status: 500 },
      );
    }

    // Trust the SQL shape and cast it:
    const result = data as OverdraftSettlementResult;

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
