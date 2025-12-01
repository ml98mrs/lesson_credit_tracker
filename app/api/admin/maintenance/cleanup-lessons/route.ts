// app/api/admin/maintenance/cleanup-lessons/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

const BodySchema = z.object({
  minAgeInterval: z.string().optional(), // e.g. "6 months"
  dryRun: z.boolean().optional(),
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

    const { minAgeInterval, dryRun } = parsed.data;
    const supabase = getAdminSupabase();

    const { data, error } = await supabase.rpc(
      "rpc_cleanup_past_students_lessons",
      {
        p_min_age: minAgeInterval ?? "6 months",
        p_dry_run: dryRun ?? true,
      },
    );

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message ?? "Failed to run cleanup job",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, result: data });
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
