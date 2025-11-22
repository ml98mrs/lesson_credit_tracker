// app/api/admin/teacher-expenses/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ExpenseStatus = "approved" | "rejected";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const expenseIdRaw = body?.expenseId;
    const nextStatus = body?.status as ExpenseStatus | undefined;

    const expenseId = Number(expenseIdRaw);
    if (!Number.isFinite(expenseId) || expenseId <= 0) {
      return NextResponse.json(
        { error: "Valid expenseId is required" },
        { status: 400 },
      );
    }

    if (!nextStatus || !["approved", "rejected"].includes(nextStatus)) {
      return NextResponse.json(
        { error: "status must be 'approved' or 'rejected'" },
        { status: 400 },
      );
    }

    const supabase = await getAdminSupabase();

    const { error } = await supabase
      .from("teacher_expenses")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", expenseId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
