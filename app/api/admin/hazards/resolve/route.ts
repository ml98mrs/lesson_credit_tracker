// app/api/admin/hazards/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

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

    // Exactly one of lessonId / allocationId must be provided
    if (hasLesson === hasAlloc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of lessonId or allocationId",
        path: ["lessonId"],
      });
    }
  });

type ResolveHazardInput = z.infer<typeof resolveHazardSchema>;
type ResolveHazardArgs =
  Database["public"]["Functions"]["rpc_resolve_hazard"]["Args"];

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const json: unknown = await req.json();
    const parsed = resolveHazardSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { hazardType, lessonId, allocationId, note }: ResolveHazardInput =
      parsed.data;

    const supabase = getAdminSupabase();

    // Build payload in a way that matches the generated types:
    // optional string fields -> omit when null/undefined.
    const payload: ResolveHazardArgs = {
      p_hazard_type: hazardType,
    };

    if (lessonId) {
      payload.p_lesson_id = lessonId;
    }

    if (allocationId) {
      payload.p_allocation_id = allocationId;
    }

    if (note !== null && note !== undefined) {
      payload.p_note = note;
    }

    const { data, error } = await supabase.rpc(
      "rpc_resolve_hazard",
      payload,
    );

    if (error) {
      console.error("rpc_resolve_hazard error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (err: unknown) {
    console.error("POST /api/admin/hazards/resolve failed", err);

    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
