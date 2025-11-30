import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { TeacherStatus } from "@/lib/enums";

const ALLOWED_STATUSES: TeacherStatus[] = [
  "current",
  "inactive",
  "potential",
  "past",
];

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const teacherId = url.searchParams.get("teacherId");
  const statusParam = url.searchParams.get("status") as TeacherStatus | null;

  if (!teacherId || !statusParam) {
    return NextResponse.json(
      { error: "teacherId and status are required" },
      { status: 400 },
    );
  }

  if (!ALLOWED_STATUSES.includes(statusParam)) {
    return NextResponse.json(
      { error: `Invalid status: ${statusParam}` },
      { status: 400 },
    );
  }

  const sb = getAdminSupabase();

  const { error } = await sb
    .from("teachers")
    .update({ status: statusParam })
    .eq("id", teacherId);

  if (error) {
    console.error("Error updating teacher status", error.message);
    return NextResponse.json(
      { error: "Failed to update teacher status" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
