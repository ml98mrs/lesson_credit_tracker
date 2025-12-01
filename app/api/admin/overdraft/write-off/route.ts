// app/api/admin/overdraft/write-off/route.ts
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
      reasonCode?: string;
      note?: string | null;
      accountingPeriod?: string | null;
    };

    const studentId = body.studentId;
    const reasonCode = body.reasonCode;
    const note = body.note ?? null;
    const accountingPeriod = body.accountingPeriod ?? null;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 },
      );
    }

    if (!reasonCode || !reasonCode.trim()) {
      return NextResponse.json(
        { error: "reasonCode is required" },
        { status: 400 },
      );
    }

    const sb = getAdminSupabase();

    const { data, error } = await sb.rpc("rpc_write_off_overdraft", {
      p_student_id: studentId,
      p_reason_code: reasonCode,
      p_note: note,
      p_accounting_period: accountingPeriod,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to write off overdraft" },
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
