// app/api/admin/teacher-expenses/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  expenseId?: number | string;
  status?: "pending" | "approved" | "rejected";
};

async function handleUpdate(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const rawId = body.expenseId;
    const expenseId =
      typeof rawId === "string" ? Number.parseInt(rawId, 10) : rawId;

    const status = body.status;

    if (!expenseId || !status) {
      return NextResponse.json(
        { error: "expenseId and status are required" },
        { status: 400 },
      );
    }

    const supabase = await getAdminSupabase();

    const { data, error } = await supabase
      .from("teacher_expenses")
      .update({ status })
      .eq("id", expenseId)
      .select("id, status")
      .single(); // 0 rows => error

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, expenseId: data.id, status: data.status },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  return handleUpdate(req);
}

export async function POST(req: Request) {
  return handleUpdate(req);
}
