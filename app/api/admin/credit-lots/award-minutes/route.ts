import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AWARD_REASON_CODES } from "@/lib/awardReasons";

const ISO_DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const AwardSchema = z.object({
  studentId: z.string().uuid(),
  minutesGranted: z.number().int().positive(),
  startDate: ISO_DATE, // YYYY-MM-DD
  awardReasonCode: z.enum(AWARD_REASON_CODES),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AwardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request",
          issues: parsed.error.flatten(),
        },
        { status: 422 }
      );
    }

    const p = parsed.data;
    const supabase = getAdminSupabase();

    const { data, error } = await supabase.rpc("rpc_award_minutes", {
      p_student_id: p.studentId,
      p_minutes_granted: p.minutesGranted,
      p_start_date: p.startDate,
      p_award_reason_code: p.awardReasonCode,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message ?? "Error awarding minutes",
        },
        { status: 500 }
      );
    }

    const lot = data as { id?: string } | null;
    const creditLotId = lot?.id;

    if (!creditLotId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Award minutes RPC did not return a credit lot. Please contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        creditLotId,
        lot,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Unexpected error",
      },
      { status: 500 }
    );
  }
}
