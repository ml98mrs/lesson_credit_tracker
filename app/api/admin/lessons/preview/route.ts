import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lessonId: z.string().uuid(),
  override: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { lessonId, override } = parsed.data;

    const sb = getAdminSupabase();

    const { data, error } = await sb.rpc("rpc_preview_lesson_allocation", {
      p_lesson_id: lessonId,
      p_admin_override: override ?? false,
    });

    if (error) {
      console.error("rpc_preview_lesson_allocation error", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    // data is the JSONB returned by the planner
    return NextResponse.json(data ?? {});
  } catch (e: any) {
    console.error("POST /api/admin/lessons/preview failed", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
