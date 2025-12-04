// app/(teacher)/teacher/invoices/[invoiceId]/download/route.ts
import { NextRequest } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";
import { loadTeacherInvoiceSnapshot } from "@/lib/server/loadTeacherInvoiceSnapshot";
import {
  buildTeacherInvoiceExcelBuffer,
  buildTeacherInvoiceExcelFileName,
} from "@/lib/server/teacherInvoiceExcel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    invoiceId: string;
  }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { invoiceId } = await params;
  const invoiceIdNumber = Number(invoiceId);

  if (!Number.isFinite(invoiceIdNumber)) {
    return new Response("Invalid invoiceId", { status: 400 });
  }

  const supabase = await getServerSupabase();

  // 0) Map logged-in user → teacher_id
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;

  if (!user) {
    return new Response("Not authenticated", { status: 401 });
  }

  const { data: t, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (teacherError || !t?.id) {
    return new Response("Teacher record not found", { status: 403 });
  }

  const teacherId = t.id as string;

  // 1) Load invoice snapshot (and enforce "paid only")
  let snapshot;
  try {
    snapshot = await loadTeacherInvoiceSnapshot({
      supabase,
      teacherId,
      invoiceId: invoiceIdNumber,
      requirePaid: true,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Invoice not paid yet") {
      return new Response("Invoice must be marked as paid before download.", {
        status: 403,
      });
    }
    console.error("Error loading teacher invoice snapshot for Excel:", err);
    return new Response("Invoice not found or not accessible", {
      status: 404,
    });
  }

  const {
    monthStart,
    monthLabel,
    lessonMinutesTotal,
    lessonGrossPennies,
    sncFreeMinutes,
    sncChargedMinutes,
    approvedExpensesPennies,
    pendingExpensesPennies,
    rejectedExpensesPennies,
    totalPennies,
    studentEarnings,
    studentNameById,
    expenseDetails,
  } = snapshot;

  // Teacher label for header + filename
  const meta = (user.user_metadata || {}) as { full_name?: string };
  const teacherLabel =
    meta.full_name ?? user.email ?? `Teacher ${teacherId}`;

  // 2) Build Excel buffer via shared helper
  const excelBuffer = await buildTeacherInvoiceExcelBuffer({
    teacherLabel,
    monthLabel,
    monthStart,

    lessonMinutesTotal,
    lessonGrossPennies,
    sncFreeMinutes,
    sncChargedMinutes,

    approvedExpensesPennies,
    pendingExpensesPennies,
    rejectedExpensesPennies,
    totalPennies,

    studentEarnings,
    studentNameById,
    expenseDetails,
  });

  const fileName = buildTeacherInvoiceExcelFileName(monthStart, teacherLabel);

  return new Response(Buffer.from(excelBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
