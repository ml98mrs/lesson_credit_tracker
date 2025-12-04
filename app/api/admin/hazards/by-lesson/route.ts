// app/api/admin/hazards/by-lesson/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { lessonHazardsBaseQuery } from "@/lib/api/admin/lessons";
import type { HazardType } from "@/lib/enums";

export const dynamic = "force-dynamic";

type HazardRow = {
  lesson_id: string;
  allocation_id: string | null;
  hazard_type: HazardType;
  severity: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const lessonId = url.searchParams.get("lessonId");

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId is required" },
        { status: 400 },
      );
    }

    const sb = getAdminSupabase();

    const { data, error } = await lessonHazardsBaseQuery(sb)
      .eq("lesson_id", lessonId)
      .returns<HazardRow[]>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Keep response shape the same
    return NextResponse.json({ hazards: data ?? [] });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
