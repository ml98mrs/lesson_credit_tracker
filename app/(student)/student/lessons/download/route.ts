// app/(student)/student/lessons/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatStudentDateTime } from "@/lib/formatters";
import type { ProfileRow } from "@/lib/types/profiles";
import type { Delivery } from "@/lib/enums";
import {
  fetchStudentLessons,
  type StudentLessonsFilter,
  type StudentLessonRow as LessonRow,
} from "@/lib/api/student/lessons";
import { formatDeliveryLabel } from "@/lib/domain/lessons";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Logo helper (same pattern as teacher invoice) ---

let invoiceLogoBufferCache: Buffer | null = null;

function getInvoiceLogoBuffer(): Buffer | null {
  if (invoiceLogoBufferCache) return invoiceLogoBufferCache;

  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "brand",
      "PSEnglish_logo.png",
    );

    const fileBuffer = fs.readFileSync(logoPath);
    invoiceLogoBufferCache = fileBuffer;
    return invoiceLogoBufferCache;
  } catch (error) {
    console.error("Student lessons export logo not found:", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabase();

  // 1) Logged-in user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Student linked to this profile
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
      {
        error:
          "No student record is linked to this account. Please contact the administrator.",
      },
      { status: 400 },
    );
  }

  const studentId = studentRow.id as string;

  // 3) Profile timezone (for student-facing date/time)
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<ProfileRow, "timezone">>();

  if (profileErr) {
    return NextResponse.json(
      { error: "Failed to load profile timezone." },
      { status: 500 },
    );
  }

  const studentTimeZone = profileRow?.timezone ?? "Europe/London";

// 4) Read filters from query string (mirror the page’s logic)
const url = new URL(req.url);
const sp = url.searchParams;

const monthParam = sp.get("month") || undefined;
const yearParam = sp.get("year") || undefined;
const dateFrom = sp.get("from") || undefined;
const dateTo = sp.get("to") || undefined;
const teacherFilter = sp.get("teacher") || undefined;
const deliveryFilter =
  (sp.get("delivery") as Delivery | null) || undefined;

// ✅ Narrow snc to the allowed literal values for StudentLessonsFilter["snc"]
const rawSnc = sp.get("snc");
const sncFilter: StudentLessonsFilter["snc"] =
  rawSnc === "snc" ||
  rawSnc === "free" ||
  rawSnc === "charged" ||
  rawSnc === "none" ||
  rawSnc === ""
    ? (rawSnc as StudentLessonsFilter["snc"])
    : undefined;

const invoiceFilter = sp.get("invoice") || undefined;

const filterObj: StudentLessonsFilter = {
  month: monthParam,
  year: yearParam,
  from: dateFrom,
  to: dateTo,
  teacher: teacherFilter,
  delivery: deliveryFilter,
  snc: sncFilter,          // <- now correctly typed
  invoice: invoiceFilter,
};


  // 5) Shared lessons fetch (same source of truth as the page)
  const lessons: LessonRow[] = await fetchStudentLessons(
    supabase,
    studentId,
    filterObj,
  );

  // 6) Build Excel workbook (keeping existing column widths)
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lessons");

  // Column setup
  sheet.columns = [
    { header: "Date & time", key: "dateTime", width: 24 },
    { header: "Teacher", key: "teacher", width: 24 },
    { header: "Delivery", key: "delivery", width: 12 },
    { header: "Duration (min)", key: "duration", width: 14 },
    { header: "SNC", key: "snc", width: 18 },
    { header: "Credit summary", key: "credit", width: 40 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.getRow(1).height = 18;

  // Per-delivery accumulators (minutes)
  let onlineMinutes = 0;
  let f2fMinutes = 0;

  // Data rows
  for (const lesson of lessons) {
    const dateLabel = formatStudentDateTime(
      lesson.occurred_at,
      studentTimeZone,
    );

    let sncLabel = "No";
    if (lesson.is_snc) {
      if (lesson.snc_mode === "free") {
        sncLabel = "Free SNC (no credit used)";
      } else if (lesson.snc_mode === "charged") {
        sncLabel = "Charged SNC (minutes deducted)";
      } else {
        sncLabel = "SNC";
      }
    }

    const deliveryLabel =
  lesson.delivery === "hybrid"
    ? "Hybrid"
    : formatDeliveryLabel(lesson.delivery as Delivery);

    // Track per-delivery totals (minutes)
    if (lesson.delivery === "online") {
      onlineMinutes += lesson.duration_min;
    } else if (lesson.delivery === "f2f") {
      f2fMinutes += lesson.duration_min;
    }

    sheet.addRow({
      dateTime: dateLabel,
      teacher: lesson.teacher_full_name,
      delivery: deliveryLabel,
      duration: lesson.duration_min,
      snc: sncLabel,
      credit:
        lesson.allocation_summary ??
        (lesson.is_snc && lesson.snc_mode === "free"
          ? "Free SNC (no credit used)"
          : ""),
    });
  }

  // Numeric formatting for duration
  sheet.getColumn("duration").numFmt = "0";

  // 7) Footer: per-delivery subtotals (hours)
  const lastDataRow = sheet.lastRow?.number ?? 1;
  const summaryStartRow = lastDataRow + 2;

  const onlineHours = onlineMinutes / 60;
  const f2fHours = f2fMinutes / 60;

  const headerCell = sheet.getCell(`A${summaryStartRow}`);
  headerCell.value = "Per-delivery totals (hours)";
  headerCell.font = { bold: true };

  const onlineRow = summaryStartRow + 1;
  const f2fRow = summaryStartRow + 2;

  sheet.getCell(`A${onlineRow}`).value = "Online lessons (hours)";
  sheet.getCell(`B${onlineRow}`).value = onlineHours;
  sheet.getCell(`B${onlineRow}`).numFmt = "0.00";

  sheet.getCell(`A${f2fRow}`).value = "Face to face lessons (hours)";
  sheet.getCell(`B${f2fRow}`).value = f2fHours;
  sheet.getCell(`B${f2fRow}`).numFmt = "0.00";

  // 8) Insert top branding band: logo (left) + address (right)
  // Insert 10 empty rows at top so header + data start at row 11
  sheet.spliceRows(1, 0, [], [], [], [], [], [], [], [], [], []);

  // Address block in column F (F1–F8)
  const addressLines = [
    "PS English Limited",
    "37 Abbots Gardens",
    "London, N2 OJG",
    "UNITED KINGDOM",
    "+44 20 8248 7985",
    "+44 7855 507 779",
    "ask@psenglish.co.uk",
    "www.psenglish.co.uk",
  ];

  addressLines.forEach((line, index) => {
    const rowNumber = 1 + index; // rows 1–8
    const cell = sheet.getCell(`F${rowNumber}`);
    cell.value = line;
    cell.font = { size: 10 };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });

  // Logo on the left: A1–A5
  const logoBuffer = getInvoiceLogoBuffer();
  if (logoBuffer) {
    const logoId = workbook.addImage(
      {
        buffer: logoBuffer,
        extension: "png",
      } as any,
    );

    sheet.addImage(logoId, "A1:A5");
  }

  // Header text under logo in column A (A6–A8)
  sheet.getCell("A6").value = "PS English";
  sheet.getCell("A7").value = "Student Lessons";
  sheet.getCell("A8").value = "Lesson history export";

  ["A6", "A7", "A8"].forEach((addr) => {
    const cell = sheet.getCell(addr);
    cell.alignment = { horizontal: "left", vertical: "middle" };
    if (addr === "A6") {
      cell.font = { size: 14, bold: true };
    } else if (addr === "A7") {
      cell.font = { size: 12, bold: true };
    } else {
      cell.font = { size: 11 };
    }
  });

  // 9) Generate buffer and respond
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = "psenglish-student-lessons.xlsx";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
