// app/api/admin/overdraft/write-off/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type WriteOffOverdraftArgs =
  Database["public"]["Functions"]["rpc_write_off_overdraft"]["Args"];

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
    const reasonCode = body.reasonCode?.trim();
    const note = body.note;
    const accountingPeriod = body.accountingPeriod?.trim() ?? null;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 },
      );
    }

    if (!reasonCode) {
      return NextResponse.json(
        { error: "reasonCode is required" },
        { status: 400 },
      );
    }

    const sb = getAdminSupabase();

    const args: WriteOffOverdraftArgs = {
      p_student_id: studentId,
      p_reason_code: reasonCode,
    };

    // Optional note: generated types are usually string | undefined.
    // SQL treats NULL as "no note", so omitting is equivalent.
    if (note !== null && note !== undefined && note.trim() !== "") {
      args.p_note = note;
    }

    // Optional accounting period: same pattern.
    if (accountingPeriod) {
      args.p_accounting_period = accountingPeriod;
    }

    const { data, error } = await sb.rpc("rpc_write_off_overdraft", args);

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
