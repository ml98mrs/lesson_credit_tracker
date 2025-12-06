// app/api/teacher/expenses/route.ts
import { NextResponse } from "next/server";
import { getTeacherSupabase } from "@/lib/supabase/teacher";

export const dynamic = "force-dynamic";

type Category = "drinks" | "teaching_resources" | "other";

// Infer the Supabase client type from getTeacherSupabase
type TeacherSupabaseClient = Awaited<ReturnType<typeof getTeacherSupabase>>;

// Small helper to resolve the current teacher_id from a teacher-scoped client
async function getCurrentTeacherIdFromSupabaseClient(
  supabase: TeacherSupabaseClient,
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("NOT_AUTHENTICATED_TEACHER");
  }

  const { data: teacherRow, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (teacherError || !teacherRow?.id) {
    throw new Error("TEACHER_NOT_FOUND");
  }

  return teacherRow.id;
}

// ────────────────────────────────────────────────────────────
// POST  /api/teacher/expenses   → log a new expense
// ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      incurredAt?: string;
      amountPounds?: unknown;
      category?: Category;
      description?: unknown;
      studentId?: string;
    };

    const incurredAt = body.incurredAt; // "YYYY-MM-DD"
    const amountPoundsRaw = body.amountPounds;
    const category = body.category;
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    const studentId = body.studentId; // required

    if (!incurredAt) {
      return NextResponse.json(
        { error: "incurredAt (date) is required" },
        { status: 400 },
      );
    }

    const amountPounds = Number(amountPoundsRaw);
    if (!Number.isFinite(amountPounds) || amountPounds <= 0) {
      return NextResponse.json(
        { error: "amountPounds must be a positive number" },
        { status: 400 },
      );
    }

    if (
      !category ||
      !["drinks", "teaching_resources", "other"].includes(category)
    ) {
      return NextResponse.json(
        {
          error:
            "category must be 'drinks', 'teaching_resources', or 'other'",
        },
        { status: 400 },
      );
    }

    // Require a student for every expense
    if (
      !studentId ||
      typeof studentId !== "string" ||
      studentId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "studentId is required for an expense." },
        { status: 400 },
      );
    }

    // Require description for teaching_resources & other (UI rule)
    if (
      (category === "teaching_resources" || category === "other") &&
      (!description || description.length === 0)
    ) {
      return NextResponse.json(
        { error: "Please add details for this expense." },
        { status: 400 },
      );
    }

    const incurredDate = new Date(incurredAt);
    if (Number.isNaN(incurredDate.getTime())) {
      return NextResponse.json(
        { error: "incurredAt must be a valid date (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const amountPennies = Math.round(amountPounds * 100);

    const supabase = await getTeacherSupabase();

    // Resolve the current teacher_id from auth + teachers table
    let teacherId: string;
    try {
      teacherId = await getCurrentTeacherIdFromSupabaseClient(supabase);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "NOT_AUTHENTICATED_TEACHER") {
          return NextResponse.json(
            { error: "Not authenticated as a teacher." },
            { status: 401 },
          );
        }
        if (err.message === "TEACHER_NOT_FOUND") {
          return NextResponse.json(
            { error: "Teacher record not found for this user." },
            { status: 404 },
          );
        }
      }
      throw err;
    }

    // Compute month_start (YYYY-MM-01) for incurredAt
    const monthStart = new Date(
      incurredDate.getUTCFullYear(),
      incurredDate.getUTCMonth(),
      1,
    );
    const monthStartStr = monthStart.toISOString().slice(0, 10); // "YYYY-MM-01"

    // Check if there is an already-paid invoice for THIS teacher & month
    const { data: existingInvoice, error: invoiceError } = await supabase
      .from("teacher_invoices")
      .select("id, status, month_start")
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStartStr)
      .eq("status", "paid")
      .maybeSingle();

    if (invoiceError) {
      return NextResponse.json(
        { error: invoiceError.message },
        { status: 400 },
      );
    }

    if (existingInvoice) {
      return NextResponse.json(
        {
          error:
            "You can't log a new expense for a month where your invoice has already been paid. Please contact the office.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("rpc_log_teacher_expense", {
  p_incurred_at: incurredDate.toISOString(),
  p_amount_pennies: amountPennies,
  p_category: category,
  p_description: description ?? "", // make it a definite string
  p_student_id: studentId,
});


    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data }, { status: 200 });
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

// ────────────────────────────────────────────────────────────
// DELETE  /api/teacher/expenses   → delete a pending expense
// ────────────────────────────────────────────────────────────
type DeleteBody = {
  expenseId?: number | string;
};

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as DeleteBody;

    const expenseIdNum =
      typeof body.expenseId === "string"
        ? Number.parseInt(body.expenseId, 10)
        : body.expenseId;

    if (!expenseIdNum || Number.isNaN(expenseIdNum)) {
      return NextResponse.json(
        { error: "expenseId is required" },
        { status: 400 },
      );
    }

    const supabase = await getTeacherSupabase();

    // 1) Load the expense first (RLS ensures this is only the current teacher's)
    const { data: row, error: fetchError } = await supabase
      .from("teacher_expenses")
      .select("id, status")
      .eq("id", expenseIdNum)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 400 },
      );
    }

    if (!row) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 },
      );
    }

    if (row.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending expenses can be deleted" },
        { status: 400 },
      );
    }

    // 2) Try to delete it. If RLS blocks this, data will be null.
    const { data: deleted, error: deleteError } = await supabase
      .from("teacher_expenses")
      .delete()
      .eq("id", expenseIdNum)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 },
      );
    }

    if (!deleted) {
      return NextResponse.json(
        {
          error:
            "Could not delete expense (it may not belong to you or delete is not allowed by policies).",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
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
