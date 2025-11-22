// app/api/admin/maintenance/mark-dormant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

const BodySchema = z.object({
  inactiveInterval: z.string().optional(), // e.g. "3 months"
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

    const { inactiveInterval } = parsed.data;
    const supabase = getAdminSupabase();

    const { data, error } = await supabase.rpc("rpc_mark_students_dormant", {
      // PG interval can be cast from text like '3 months'
      p_inactive_interval: inactiveInterval ?? "3 months",
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message ?? "Failed to run dormant job",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
}
