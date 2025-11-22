// app/api/admin/teachers/rates/base/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  teacherId: z.string().uuid(),
  defaultOnlineRatePounds: z.string().optional().default("0"),
  f2fBasicRatePounds: z.string().optional().default("0"),
  f2fPremiumRatePounds: z.string().optional().default("0"),
});

function poundsStringToPennies(value: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("Rate must be a non-negative number.");
  }
  return Math.round(num * 100);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = payloadSchema.parse(json);

    const defaultOnlinePennies = poundsStringToPennies(
      parsed.defaultOnlineRatePounds,
    );
    const f2fBasicPennies = poundsStringToPennies(
      parsed.f2fBasicRatePounds,
    );
    const f2fPremiumPennies = poundsStringToPennies(
      parsed.f2fPremiumRatePounds,
    );

    const sb = getAdminSupabase();

    const { data, error } = await sb
      .from("teacher_rates")
      .upsert(
        {
          teacher_id: parsed.teacherId,
          default_online_rate_pennies: defaultOnlinePennies,
          f2f_basic_rate_pennies: f2fBasicPennies,
          f2f_premium_rate_pennies: f2fPremiumPennies,
        },
        { onConflict: "teacher_id" },
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error("teacher_rates upsert error", error.message);
      return NextResponse.json(
        { message: "Failed to save base rates" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("POST /admin/teachers/rates/base error", err);
    return NextResponse.json(
      { message: err.message || "Invalid input" },
      { status: 400 },
    );
  }
}
