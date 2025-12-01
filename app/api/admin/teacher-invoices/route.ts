// app/api/admin/teacher-invoices/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  teacherId?: string;
  monthStart?: string; // 'YYYY-MM-DD'
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const teacherId = body.teacherId;
    const monthStart = body.monthStart;

    if (!teacherId || !monthStart) {
      return NextResponse.json(
        { error: "teacherId and monthStart are required" },
        { status: 400 },
      );
    }

    const supabase = await getAdminSupabase();

    // 1) Check if an invoice already exists for this teacher + month
    const { data: existing, error: existingError } = await supabase
      .from("teacher_invoices")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 400 },
      );
    }

    if (existing) {
      // Idempotent: just return the existing invoice id
      return NextResponse.json({ invoiceId: existing.id }, { status: 200 });
    }

    // 2) (Optional but nice) sanity-check that a summary row exists for this month
    const { data: summary, error: summaryError } = await supabase
      .from("v_teacher_invoice_summary")
      .select("teacher_id, month_start")
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .maybeSingle();

    if (summaryError) {
      return NextResponse.json(
        { error: summaryError.message },
        { status: 400 },
      );
    }

    if (!summary) {
      return NextResponse.json(
        {
          error:
            "No invoice summary found for this teacher and month (no confirmed lessons or approved expenses).",
        },
        { status: 400 },
      );
    }

    // 3) Insert a new invoice row with status 'generated'
    const { data: inserted, error: insertError } = await supabase
      .from("teacher_invoices")
      .insert({
        teacher_id: teacherId,
        month_start: monthStart,
        status: "generated",
        invoice_ref: null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create invoice row" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { invoiceId: inserted.id },
      { status: 201 },
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
