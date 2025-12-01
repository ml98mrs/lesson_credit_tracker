// app/api/admin/teachers/rates/override/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

const upsertSchema = z.object({
  teacherId: z.string().uuid(),
  studentId: z.string().uuid(),
  f2fRatePounds: z.string(),
});

const deleteSchema = z.object({
  teacherId: z.string().uuid(),
  studentId: z.string().uuid(),
});

function poundsStringToPennies(value: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("Rate must be a non-negative number.");
  }
  return Math.round(num * 100);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = upsertSchema.parse(json);

    const pennies = poundsStringToPennies(parsed.f2fRatePounds);

    const sb = getAdminSupabase();

    const { data, error } = await sb
      .from("teacher_student_f2f_overrides")
      .upsert(
        {
          teacher_id: parsed.teacherId,
          student_id: parsed.studentId,
          f2f_rate_pennies: pennies,
        },
        { onConflict: "teacher_id,student_id" },
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error("override upsert error", error.message);
      return NextResponse.json(
        { message: "Failed to save override" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
  console.error("POST /admin/teachers/rates/override error", err);

  if (err instanceof Error) {
    return NextResponse.json(
      { message: err.message || "Invalid input" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { message: "Invalid input" },
    { status: 400 },
  );
}

}

export async function DELETE(req: Request) {
  try {
    const json = await req.json();
    const parsed = deleteSchema.parse(json);

    const sb = getAdminSupabase();

    const { error } = await sb
      .from("teacher_student_f2f_overrides")
      .delete()
      .match({
        teacher_id: parsed.teacherId,
        student_id: parsed.studentId,
      });

    if (error) {
      console.error("override delete error", error.message);
      return NextResponse.json(
        { message: "Failed to delete override" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
  console.error("DELETE /admin/teachers/rates/override error", err);

  if (err instanceof Error) {
    return NextResponse.json(
      { message: err.message || "Invalid input" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { message: "Invalid input" },
    { status: 400 },
  );
}

}
