// app/api/admin/students/update-tier/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { TIER, type Tier } from "@/lib/enums";

export const dynamic = "force-dynamic";

// Body: { studentId: string; tier?: "" | Tier | null }
const BodySchema = z.object({
  studentId: z.string().uuid(),
  // UI sends "" for "no tier", or a real tier; we also allow null
  tier: z.union([z.enum(TIER), z.literal("")]).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { studentId, tier: tierRaw } = parsed.data;

    // After Zod validation, tierRaw is "" | Tier | null | undefined
    // Convert "" / null / undefined → null in DB, otherwise a Tier
    const tier: Tier | null =
      tierRaw === "" || tierRaw == null ? null : (tierRaw as Tier);

    const supabase = getAdminSupabase();

    const { error } = await supabase
      .from("students")
      .update({ tier })
      .eq("id", studentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, tier });
  } catch (e: unknown) {
    if (e instanceof Error) {
      return NextResponse.json(
        { error: e.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Unknown error" },
      { status: 500 }
    );
  }
}
