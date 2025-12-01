// app/api/admin/record-queries/route.ts
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

type PatchBody = {
  queryId: string;
  status?: string;
  adminNote?: string;
  resolutionCode?: string | null;
};

type UpdatePayload = {
  status?: string;
  admin_note?: string;
  resolution_code?: string | null;
  resolved_at?: string;
};

export async function PATCH(req: Request) {
  const supabase = await getAdminSupabase();

  const payload = (await req.json()) as PatchBody;
  const { queryId, status, adminNote, resolutionCode } = payload;

  if (!queryId) {
    return NextResponse.json({ error: "Missing queryId" }, { status: 400 });
  }

  const update: UpdatePayload = {};

  if (status) update.status = status;
  if (adminNote !== undefined) update.admin_note = adminNote;
  if (resolutionCode !== undefined) update.resolution_code = resolutionCode;
  if (status === "resolved") {
    update.resolved_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("student_record_queries")
    .update(update)
    .eq("id", queryId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update query" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
