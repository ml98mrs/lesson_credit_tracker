// app/api/admin/teacher-expenses/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const expenseId = body?.expenseId as number | undefined;
    const status = body?.status as "pending" | "approved" | "rejected" | undefined;

    if (!expenseId || !status) {
      return NextResponse.json(
        { error: "expenseId and status are required" },
        { status: 400 },
      );
    }

    const supabase = await getAdminSupabase();

    const { error } = await supabase
      .from("teacher_expenses")
      .update({ status })
      .eq("id", expenseId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
