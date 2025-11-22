// app/api/admin/lessons/confirm/route.ts

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const lessonId = body?.lessonId as string | undefined;
    const override = Boolean(body?.override);
    const reason =
      typeof body?.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : null;

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId is required" },
        { status: 400 },
      );
    }

    const sb = getAdminSupabase();

    const { data, error } = await sb
      .rpc("rpc_confirm_lesson", {
        p_lesson_id: lessonId,
        p_admin_override: override,
        p_override_reason: reason,
        p_reallocate: false, // keep your existing behaviour
      })
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // SNC-aware status message
    const isSnc = !!(data as any)?.is_snc;
    const isFreeSnc = !!(data as any)?.is_free_snc;

    let statusMessage = "Lesson confirmed.";

    if (isSnc) {
      statusMessage = isFreeSnc
        ? "Free SNC confirmed — no credit deducted."
        : "Charged SNC confirmed — minutes deducted as normal.";
    }

    return NextResponse.json({
      ok: true,
      result: data,
      statusMessage,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
