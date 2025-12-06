// app/api/admin/students/write-off-overdraft/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

const BodySchema = z.object({
  studentId: z.string().uuid(),
  reasonCode: z
    .enum([
      "manual_write_off",
      "expired_credit",
      "overdraft_write_off",
      "adjustment",
    ])
    .optional(),
  note: z.string().optional(),
  accountingPeriod: z.string().optional(),
});

type WriteOffOverdraftCreditArgs =
  Database["public"]["Functions"]["rpc_write_off_overdraft_credit"]["Args"];

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request",
          issues: parsed.error.flatten(),
        },
        { status: 422 },
      );
    }

    const { studentId, reasonCode, note, accountingPeriod } = parsed.data;

    const supabase = getAdminSupabase();

    const args: WriteOffOverdraftCreditArgs = {
      p_student_id: studentId,
      p_reason_code: reasonCode ?? "overdraft_write_off",
    };

    // Optional note: only send if non-empty; omitting == NULL in SQL
    if (note && note.trim() !== "") {
      args.p_note = note;
    }

    // Optional accounting period: same pattern
    if (accountingPeriod && accountingPeriod.trim() !== "") {
      args.p_accounting_period = accountingPeriod;
    }

    const { data, error } = await supabase.rpc(
      "rpc_write_off_overdraft_credit",
      args,
    );

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message ?? "Failed to write off overdraft",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: unknown) {
    if (e instanceof Error) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unexpected error" },
      { status: 500 },
    );
  }
}
