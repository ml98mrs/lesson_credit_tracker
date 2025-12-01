// app/api/admin/students/update-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

const BodySchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(["current", "dormant", "past"]),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
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

    const { studentId, status } = parsed.data;
    const supabase = getAdminSupabase();

    // Guard: don’t allow setting to "past" while there is any non-zero balance
    if (status === "past") {
      const { data: lots, error: lotsErr } = await supabase
        .from("v_credit_lot_remaining")
        .select("minutes_remaining")
        .eq("student_id", studentId);

      if (lotsErr) {
        return NextResponse.json(
          {
            ok: false,
            error:
              lotsErr.message ??
              "Failed to check remaining credit before updating status",
          },
          { status: 500 },
        );
      }

      const totalRemaining = (lots ?? []).reduce(
        (sum, row: any) => sum + (row.minutes_remaining ?? 0),
        0,
      );

      if (totalRemaining !== 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Cannot mark student as past while they still have a non-zero credit balance. " +
              "Write off or settle their remaining credit first.",
          },
          { status: 400 },
        );
      }
    }

    const { error } = await supabase
      .from("students")
      .update({ status })
      .eq("id", studentId);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message ?? "Failed to update student status",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
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
