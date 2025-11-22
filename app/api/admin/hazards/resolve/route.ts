// app/api/admin/hazards/resolve/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

const resolveHazardSchema = z
  .object({
    hazardType: z.string().min(1),
    lessonId: z.string().uuid().nullable().optional(),
    allocationId: z.string().uuid().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const hasLesson = !!data.lessonId;
    const hasAlloc = !!data.allocationId;

    if (hasLesson === hasAlloc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of lessonId or allocationId",
        path: ["lessonId"],
      });
    }
  });

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = resolveHazardSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { hazardType, lessonId, allocationId, note } = parsed.data;

    const supabase = getAdminSupabase();

    const { data, error } = await supabase.rpc("rpc_resolve_hazard", {
      p_hazard_type: hazardType,
      p_lesson_id: lessonId ?? null,
      p_allocation_id: allocationId ?? null,
      p_note: note ?? null,
    });

    if (error) {
      console.error("rpc_resolve_hazard error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (e: any) {
    console.error("POST /api/admin/hazards/resolve failed", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
