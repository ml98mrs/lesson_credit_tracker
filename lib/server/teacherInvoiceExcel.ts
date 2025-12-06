// lib/server/teacherInvoiceExcel.ts

import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { formatDateTimeLondon } from "@/lib/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Shape of the data we need to build the workbook.
// Both admin + teacher routes will prepare this and call the helper.
export type TeacherInvoiceExcelInput = {
  teacherLabel: string;
  monthLabel: string;
  monthStart: string;

  lessonMinutesTotal: number;
  lessonGrossPennies: number;
  sncFreeMinutes: number;
  sncChargedMinutes: number;

  approvedExpensesPennies: number;
  pendingExpensesPennies: number;
  rejectedExpensesPennies: number;
  totalPennies: number;

  studentEarnings: Array<{
    teacher_id: string;
    month_start: string;
    student_id: string;
    lesson_minutes_total: number | null;
    gross_pennies: number | null;
  }>;

  studentNameById: Map<string, string>;

  expenseDetails: Array<{
    id: number;
    teacher_id: string;
    month_start: string;
    incurred_at: string;
    amount_pennies: number;
    status: "pending" | "approved" | "rejected";
    description: string | null;
    category: "drinks" | "teaching_resources" | "other";
    student_id: string | null;
    student_name: string | null;
    student_full_name: string | null;
  }>;
};

// ---------------------------------------------------------------------------
// Shared styling constants
// ---------------------------------------------------------------------------

const BRAND_BLUE = "FF1F4E79"; // tweak to your brand colour later

const HEADER_STYLE = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } },
  alignment: { vertical: "middle", horizontal: "center" as const },
  border: {
    top: { style: "thin" as const },
    left: { style: "thin" as const },
    bottom: { style: "thin" as const },
    right: { style: "thin" as const },
  },
};

const CELL_BORDER = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

const MONEY_FORMAT = '£#,##0.00;[Red]-£#,##0.00';
const HOURS_FORMAT = "0.00";

// ---------------------------------------------------------------------------
// Main Excel builder
// ---------------------------------------------------------------------------

// Build the Excel buffer from normalised data
export async function buildTeacherInvoiceExcelBuffer(
  input: TeacherInvoiceExcelInput,
): Promise<ArrayBuffer> {
  const {
    teacherLabel,
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
  } = input;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PS English Credit Portal";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Invoice", {
    properties: { defaultRowHeight: 18 },
    pageSetup: { paperSize: 9, orientation: "portrait" }, // A4
  });

  // Fixed column widths A–F (rest unused)
  sheet.getColumn(1).width = 28; // A
  sheet.getColumn(2).width = 15; // B
  sheet.getColumn(3).width = 13; // C
  sheet.getColumn(4).width = 24; // D
  sheet.getColumn(5).width = 11; // E
  sheet.getColumn(6).width = 20; // F

  addInvoiceLogoIfAvailable(workbook, sheet);
  addCompanyAddressBlock(sheet);
  addInvoiceHeaderText(sheet, teacherLabel, monthLabel);

  // Data starting with "Invoice totals" begins from row 11
  let rowIndex = 11;

rowIndex = addInvoiceTotalsSection(sheet, {
    rowIndex,
    lessonMinutesTotal,
    lessonGrossPennies,
    sncFreeMinutes,
    sncChargedMinutes,
    approvedExpensesPennies,
    pendingExpensesPennies,
    rejectedExpensesPennies,
    totalPennies,
  });

  rowIndex = addPerStudentBreakdownSection(sheet, {
    rowIndex,
    studentEarnings,
    studentNameById,
  });

  addExpensesDetailSection(sheet, {
    rowIndex,
    expenseDetails,
  });

  autoSizeUnusedColumns(sheet);

  return workbook.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// File name helper
// ---------------------------------------------------------------------------

// Build a consistent file name
export function buildTeacherInvoiceExcelFileName(
  monthStart: string,
  teacherLabel: string,
): string {
  const fileNameSafeTeacher = teacherLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "") // trim leading hyphens
    .replace(/-+$/, ""); // trim trailing hyphens

  return `teacherinvoice-${monthStart}-${fileNameSafeTeacher}.xlsx`;
}

// ---------------------------------------------------------------------------
// Helpers: money
// ---------------------------------------------------------------------------

function penniesToPounds(pennies: number | null): number {
  return (pennies ?? 0) / 100;
}

// ---------------------------------------------------------------------------
// Helpers: logo resolution
// ---------------------------------------------------------------------------

let invoiceLogoPathCache: string | null | undefined;

/**
 * Safely resolve the invoice logo path from /public.
 * - Returns null if the file is missing or unreadable.
 * - Caches the result so we don't hit the disk every request.
 */
function getInvoiceLogoPath(): string | null {
  if (invoiceLogoPathCache !== undefined) {
    return invoiceLogoPathCache;
  }

  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "brand",
      "PSEnglish_logo.png",
    );

    if (fs.existsSync(logoPath)) {
      invoiceLogoPathCache = logoPath;
    } else {
      console.error("Invoice logo not found at:", logoPath);
      invoiceLogoPathCache = null;
    }
  } catch (error) {
    console.error("Invoice logo could not be resolved:", error);
    invoiceLogoPathCache = null;
  }

  return invoiceLogoPathCache;
}

// ---------------------------------------------------------------------------
// Section helpers
// ---------------------------------------------------------------------------

function addInvoiceLogoIfAvailable(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
): void {
  try {
    const logoPath = getInvoiceLogoPath();
    if (!logoPath) return;

    const logoId = workbook.addImage({
      filename: logoPath,
      extension: "png",
    });

    // Logo top right: F1–F5
    sheet.addImage(logoId, "F1:F5");
  } catch (err) {
    console.error("Error adding invoice logo:", err);
    // Fail gracefully – Excel export still works without logo
  }
}

function addCompanyAddressBlock(sheet: ExcelJS.Worksheet): void {
  // Company address (top left, A1–A8, left-justified)
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
    const rowNumber = 1 + index; // 1–8
    const cell = sheet.getCell(`A${rowNumber}`);
    cell.value = line;
    cell.font = { size: 10 };
    cell.alignment = { horizontal: "left", vertical: "middle" };
  });
}

function addInvoiceHeaderText(
  sheet: ExcelJS.Worksheet,
  teacherLabel: string,
  monthLabel: string,
): void {
  // Header text (top right, F6–F8, right-justified)
  sheet.getCell("F6").value = "PS English";
  sheet.getCell("F7").value = "Teacher Invoice";
  sheet.getCell("F8").value = `${teacherLabel} · ${monthLabel}`;

  ["F6", "F7", "F8"].forEach((addr) => {
    const cell = sheet.getCell(addr);
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });

  sheet.getCell("F6").font = { size: 14, bold: true };
  sheet.getCell("F7").font = { size: 12, bold: true };
  sheet.getCell("F8").font = { size: 11 };
}

type TotalsSectionParams = {
  rowIndex: number;
  lessonMinutesTotal: number;
  lessonGrossPennies: number;
  sncFreeMinutes: number;
  sncChargedMinutes: number;
  approvedExpensesPennies: number;
  pendingExpensesPennies: number;
  rejectedExpensesPennies: number;
  totalPennies: number;
};

function addInvoiceTotalsSection(
  sheet: ExcelJS.Worksheet,
  params: TotalsSectionParams,
): number {
  const {
    rowIndex: startRow,
    lessonMinutesTotal,
    lessonGrossPennies,
    sncFreeMinutes,
    sncChargedMinutes,
    approvedExpensesPennies,
    pendingExpensesPennies,
    rejectedExpensesPennies,
    totalPennies,
  } = params;

  let rowIndex = startRow;

  sheet.getCell(`A${rowIndex}`).value = "Invoice totals";
  sheet.getCell(`A${rowIndex}`).font = { bold: true };
  rowIndex += 1;

  const totalsHeaderRow = sheet.getRow(rowIndex);
  const totalsHeaders = ["Label", "Value (hours / £)"] as const;
  totalsHeaders.forEach((header, idx) => {
    const cell = totalsHeaderRow.getCell(idx + 1);
    cell.value = header;
    Object.assign(cell, { style: HEADER_STYLE });
  });
  rowIndex += 1;

  const addTotalsRow = (
    label: string,
    value: number | string,
    format?: string,
  ) => {
    const row = sheet.getRow(rowIndex++);
    row.getCell(1).value = label;
    const valueCell = row.getCell(2);
    valueCell.value = typeof value === "number" ? value : value;
    if (typeof value === "number" && format) {
      valueCell.numFmt = format;
    }
    row.eachCell((cell) => {
      cell.border = CELL_BORDER;
    });
  };

  const lessonHoursTotal = lessonMinutesTotal / 60;
  const sncFreeHours = sncFreeMinutes / 60;
  const sncChargedHours = sncChargedMinutes / 60;

  addTotalsRow("Lesson hours total", lessonHoursTotal, HOURS_FORMAT);
  addTotalsRow(
    "Lesson earnings total",
    penniesToPounds(lessonGrossPennies),
    MONEY_FORMAT,
  );
  addTotalsRow(
    "Expenses (approved)",
    penniesToPounds(approvedExpensesPennies),
    MONEY_FORMAT,
  );
  addTotalsRow(
    "Expenses (pending)",
    penniesToPounds(pendingExpensesPennies),
    MONEY_FORMAT,
  );
  addTotalsRow(
    "Expenses (rejected)",
    penniesToPounds(rejectedExpensesPennies),
    MONEY_FORMAT,
  );
  addTotalsRow("Grand total", penniesToPounds(totalPennies), MONEY_FORMAT);
  addTotalsRow("SNC hours (free)", sncFreeHours, HOURS_FORMAT);
  addTotalsRow(
    "SNC hours (charged, student-side)",
    sncChargedHours,
    HOURS_FORMAT,
  );

  // Spacer after totals section
  return rowIndex + 2;
}

type PerStudentSectionParams = {
  rowIndex: number;
  studentEarnings: TeacherInvoiceExcelInput["studentEarnings"];
  studentNameById: TeacherInvoiceExcelInput["studentNameById"];
};

function addPerStudentBreakdownSection(
  sheet: ExcelJS.Worksheet,
  params: PerStudentSectionParams,
): number {
  const { rowIndex: startRow, studentEarnings, studentNameById } = params;

  let rowIndex = startRow;

  sheet.getCell(`A${rowIndex}`).value =
    "Per-student breakdown (invoice month)";
  sheet.getCell(`A${rowIndex}`).font = { bold: true };
  rowIndex += 1;

  if (studentEarnings.length === 0) {
    sheet.getCell(`A${rowIndex}`).value =
      "No confirmed lessons recorded for this invoice month.";
    return rowIndex + 2;
  }

  const headerRow = sheet.getRow(rowIndex++);
  const headers = ["Student", "Hours", "Total (£)"] as const;

  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    Object.assign(cell, { style: HEADER_STYLE });
  });

  const studentStartRow = rowIndex;

  for (const row of studentEarnings) {
    const excelRow = sheet.getRow(rowIndex++);
    const minutes = row.lesson_minutes_total ?? 0;
    const grossPennies = row.gross_pennies ?? 0;

    const fullName = studentNameById.get(row.student_id) ?? row.student_id;

    excelRow.getCell(1).value = fullName;
    excelRow.getCell(2).value = minutes / 60;
    excelRow.getCell(2).numFmt = HOURS_FORMAT;
    excelRow.getCell(3).value = penniesToPounds(grossPennies);
    excelRow.getCell(3).numFmt = MONEY_FORMAT;

    excelRow.eachCell((cell) => {
      cell.border = CELL_BORDER;
    });
  }

  const studentEndRow = rowIndex - 1;

  const totalsRow = sheet.getRow(rowIndex++);
  totalsRow.getCell(1).value = "Total";
  totalsRow.getCell(1).font = { bold: true };
  totalsRow.getCell(2).value = {
    formula: `SUM(B${studentStartRow}:B${studentEndRow})`,
  };
  totalsRow.getCell(2).numFmt = HOURS_FORMAT;
  totalsRow.getCell(3).value = {
    formula: `SUM(C${studentStartRow}:C${studentEndRow})`,
  };
  totalsRow.getCell(3).numFmt = MONEY_FORMAT;
  totalsRow.eachCell((cell) => {
    cell.border = CELL_BORDER;
  });

  // Spacer after per-student section
  return rowIndex + 2;
}

type ExpensesSectionParams = {
  rowIndex: number;
  expenseDetails: TeacherInvoiceExcelInput["expenseDetails"];
};

function addExpensesDetailSection(
  sheet: ExcelJS.Worksheet,
  params: ExpensesSectionParams,
): number {
  const { rowIndex: startRow, expenseDetails } = params;

  let rowIndex = startRow;

  sheet.getCell(`A${rowIndex}`).value = "Expenses detail";
  sheet.getCell(`A${rowIndex}`).font = { bold: true };
  rowIndex += 1;

  if (expenseDetails.length === 0) {
    sheet.getCell(`A${rowIndex}`).value =
      "No expenses logged for this invoice month.";
    return rowIndex + 1;
  }

  const headerRow = sheet.getRow(rowIndex++);
  const headers = [
    "Date",
    "Student",
    "Category",
    "Description",
    "Amount (£)",
    "Status",
  ] as const;

  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    Object.assign(cell, { style: HEADER_STYLE });
  });

  for (const exp of expenseDetails) {
    const excelRow = sheet.getRow(rowIndex++);
    excelRow.getCell(1).value = formatDateTimeLondon(exp.incurred_at);

    const studentLabel =
      exp.student_name ||
      exp.student_full_name ||
      exp.student_id ||
      "No student";

    excelRow.getCell(2).value = studentLabel;
    excelRow.getCell(3).value =
      exp.category === "drinks"
        ? "Drinks"
        : exp.category === "teaching_resources"
        ? "Teaching resources"
        : "Other";
    excelRow.getCell(4).value = exp.description ?? "";
    excelRow.getCell(5).value = penniesToPounds(exp.amount_pennies);
    excelRow.getCell(5).numFmt = MONEY_FORMAT;
    excelRow.getCell(6).value = exp.status;

    excelRow.eachCell((cell) => {
      cell.border = CELL_BORDER;
    });
  }

  return rowIndex;
}

function autoSizeUnusedColumns(sheet: ExcelJS.Worksheet): void {
  // Auto-size columns, but leave A–F (1–6) alone so layout/logo stay stable
  sheet.columns?.forEach((col, index) => {
    if (!col) return;
    const colNumber = index + 1;

    if (colNumber <= 6) {
      return;
    }

    let maxLength = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value;
      const str = cellValue ? String(cellValue) : "";
      maxLength = Math.max(maxLength, str.length + 2);
    });
    col.width = maxLength;
  });
}
