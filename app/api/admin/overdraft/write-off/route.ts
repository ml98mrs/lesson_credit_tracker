// app/api/admin/overdraft/write-off/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = body?.studentId as string | undefined;
    const reasonCode = body?.reasonCode as string | undefined;
    const note = (body?.note as string | undefined) ?? null;
    const accountingPeriod =
      (body?.accountingPeriod as string | undefined) ?? null;

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
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
