// app/api/student/record-queries/mark-seen/route.ts
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

type Body = { queryId: string };

export async function POST(req: Request) {
  const supabase = await getServerSupabase();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { queryId } = (await req.json()) as Body;

  if (!queryId) {
    return NextResponse.json({ error: "Missing queryId" }, { status: 400 });
  }

  const { error } = await supabase.rpc(
    "mark_student_record_queries_seen",
    { p_query_ids: [queryId] }, // 👈 param name must match SQL
  );

  if (error) {
    console.error("mark_student_record_queries_seen error", error);
    return NextResponse.json(
      { error: "Failed to mark query as read." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
