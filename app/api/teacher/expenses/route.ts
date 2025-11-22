// app/api/teacher/expenses/route.ts
import { NextResponse } from "next/server";
import { getTeacherSupabase } from "@/lib/supabase/teacher";

export const dynamic = "force-dynamic";

type Category = "drinks" | "teaching_resources" | "other";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const incurredAt = body?.incurredAt as string | undefined; // "YYYY-MM-DD"
    const amountPoundsRaw = body?.amountPounds;
    const category = body?.category as Category | undefined;
    const description =
      typeof body?.description === "string" ? body.description.trim() : null;

    if (!incurredAt) {
      return NextResponse.json(
        { error: "incurredAt (date) is required" },
        { status: 400 },
      );
    }

    const amountPounds = Number(amountPoundsRaw);
    if (!Number.isFinite(amountPounds) || amountPounds <= 0) {
      return NextResponse.json(
        { error: "amountPounds must be a positive number" },
        { status: 400 },
      );
    }

    if (!category || !["drinks", "teaching_resources", "other"].includes(category)) {
      return NextResponse.json(
        { error: "category must be 'drinks', 'teaching_resources', or 'other'" },
        { status: 400 },
      );
    }

    // Require description for teaching_resources & other (UI rule)
    if (
      (category === "teaching_resources" || category === "other") &&
      (!description || description.length === 0)
    ) {
      return NextResponse.json(
        { error: "Please add details for this expense." },
        { status: 400 },
      );
    }

    const incurredDate = new Date(incurredAt);
    if (Number.isNaN(incurredDate.getTime())) {
      return NextResponse.json(
        { error: "incurredAt must be a valid date (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const amountPennies = Math.round(amountPounds * 100);

    const supabase = await getTeacherSupabase();

    const { data, error } = await supabase.rpc("rpc_log_teacher_expense", {
      p_incurred_at: incurredDate.toISOString(),
      p_amount_pennies: amountPennies,
      p_category: category,
      p_description: description,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: true, result: data },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
