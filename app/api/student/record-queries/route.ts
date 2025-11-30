// app/api/student/record-queries/route.ts
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

type PostBody = {
  lessonId?: string;
  creditLotId?: string;
  body?: string;
};

export async function POST(req: Request) {
  const supabase = await getServerSupabase();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = (await req.json()) as PostBody;
  const { lessonId, creditLotId, body } = payload;

  if (!body || body.trim().length < 5) {
    return NextResponse.json(
      { error: "Please provide a short explanation (at least 5 characters)." },
      { status: 400 },
    );
  }

  const hasLesson = !!lessonId;
  const hasCredit = !!creditLotId;

  if (hasLesson === hasCredit) {
    return NextResponse.json(
      { error: "Must target exactly one of lessonId or creditLotId." },
      { status: 400 },
    );
  }

  // Resolve student_id from profile_id (= user.id)
  const { data: studentRow, error: sErr } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (sErr) {
    return NextResponse.json(
      { error: "Failed to resolve student record." },
      { status: 500 },
    );
  }

  if (!studentRow) {
    return NextResponse.json(
      { error: "No student record linked to this account." },
      { status: 400 },
    );
  }

  const studentId = studentRow.id as string;

  const insertPayload: any = {
    student_id: studentId,
    body: body.trim(),
    source: "student_portal",
  };

  if (lessonId) insertPayload.lesson_id = lessonId;
  if (creditLotId) insertPayload.credit_lot_id = creditLotId;

  const { data, error } = await supabase
    .from("student_record_queries")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to submit query." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
