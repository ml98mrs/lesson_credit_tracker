// app/api/admin/teacher-invoices/bulk-mark-paid/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  monthStart?: string; // 'YYYY-MM-01'
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const monthStart = body.monthStart;

    if (!monthStart || typeof monthStart !== "string") {
      return NextResponse.json(
        { error: "monthStart (YYYY-MM-01) is required" },
        { status: 400 },
      );
    }

    const supabase = await getAdminSupabase();

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("teacher_invoices")
      .update({ status: "paid", paid_at: nowIso })
      .eq("month_start", monthStart)
      .eq("status", "generated")
      .select("id");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    const count = data?.length ?? 0;

    return NextResponse.json(
      { ok: true, updatedCount: count },
      { status: 200 },
    );
  } catch (e: unknown) {
  if (e instanceof Error) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { error: "Unknown error" },
    { status: 500 },
  );
}

}
