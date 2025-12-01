// app/api/admin/students/update-tier/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Tier = "basic" | "premium" | "elite" | null;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = body?.studentId as string | undefined;
    const tierRaw = body?.tier as string | null | undefined;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    let tier: Tier = null;
    if (tierRaw === "basic" || tierRaw === "premium" || tierRaw === "elite") {
      tier = tierRaw;
    } else if (tierRaw !== null && tierRaw !== "" && tierRaw !== undefined) {
      return NextResponse.json(
        { error: "Invalid tier value" },
        { status: 400 }
      );
    }

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
      { status: 500 },
    );
  }

  return NextResponse.json(
    { error: "Unknown error" },
    { status: 500 },
  );
}

}
