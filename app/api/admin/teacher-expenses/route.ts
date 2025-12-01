// app/api/admin/teacher-expenses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Validate the incoming request body
const BodySchema = z.object({
  expenseId: z.union([z.number(), z.string()]),
  status: z.enum(["pending", "approved", "rejected"]),
});

type BodyInput = z.infer<typeof BodySchema>;

async function handleUpdate(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten(),
        },
        { status: 422 },
      );
    }

    const { expenseId: rawId, status } = parsed.data as BodyInput;

    // Normalise ID to a number
    const expenseId: number =
      typeof rawId === "string" ? Number.parseInt(rawId, 10) : rawId;

    if (!Number.isFinite(expenseId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid expenseId" },
        { status: 400 },
      );
    }

    const supabase = getAdminSupabase();

    const { data, error } = await supabase
      .from("teacher_expenses")
      .update({ status })
      .eq("id", expenseId)
      .select("id, status")
      .single(); // 0 rows => error

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: true, expenseId: data.id, status: data.status },
      { status: 200 },
    );
  } catch (e: unknown) {
    if (e instanceof Error) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req);
}

export async function POST(req: NextRequest) {
  return handleUpdate(req);
}
