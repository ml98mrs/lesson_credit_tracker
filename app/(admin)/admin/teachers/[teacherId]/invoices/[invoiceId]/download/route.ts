// app/(admin)/admin/teachers/[teacherId]/invoices/[invoiceId]/download/route.ts

import { NextRequest } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { loadTeacherInvoiceSnapshot } from "@/lib/server/loadTeacherInvoiceSnapshot";
import {
  buildTeacherInvoiceExcelBuffer,
  buildTeacherInvoiceExcelFileName,
} from "@/lib/server/teacherInvoiceExcel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    teacherId: string;
    invoiceId: string;
  }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { teacherId, invoiceId } = await params;

  const invoiceIdNumber = Number(invoiceId);
  if (!teacherId || !Number.isFinite(invoiceIdNumber)) {
    return new Response("Invalid teacherId or invoiceId", { status: 400 });
  }

  const supabase = await getAdminSupabase();

  // 1) Load invoice snapshot (data + totals) and enforce "paid only"
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
    console.error("Error loading invoice snapshot for Excel:", err);
    return new Response("Invoice not found or not accessible", {
      status: 404,
    });
  }

 const {
  invoice: _invoice,
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


  // 1b) Teacher label (same pattern as your pages)
  let teacherLabel = `Teacher ID ${teacherId}`;

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("profile_id")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherRow?.profile_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", teacherRow.profile_id)
      .maybeSingle();

    if (profile?.full_name) {
      teacherLabel = profile.full_name;
    }
  }

  // 2) Build Excel buffer using the shared helper
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
