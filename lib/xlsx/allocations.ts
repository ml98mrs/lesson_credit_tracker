import ExcelJS from "exceljs";
import {
  formatMinutesAsHours,
  formatDateTimeLondon,
  formatPenniesAsPounds,
} from "@/lib/formatters";
import { formatDeliveryLabel } from "@/lib/domain/delivery";
import type { AllocationRow } from "@/components/credit/LotAllocationsTable";

/**
 * Build a simple workbook for lot allocations.
 *
 * Sheet 1: "Summary"  – invoice ref, totals.
 * Sheet 2: "Usage"    – detailed allocations (mirrors LotAllocationsTable).
 */
export async function buildAllocationsWorkbook(
  allocations: AllocationRow[],
  opts?: {
    minutesGranted?: number | null;
    externalRef?: string | null;
    amountPennies?: number | null;     // 👈 NEW
  },
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();

  // ──────────────────────────────────────────────────────────────
  // 1) Summary sheet (invoice + totals)
  // ──────────────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Summary");

  const minutesGranted = opts?.minutesGranted ?? null;
  const amountPennies = opts?.amountPennies ?? null;
  const externalRef = opts?.externalRef ?? null;

  const grantedHours =
    minutesGranted != null ? formatMinutesAsHours(minutesGranted) : null;
  const amountPounds =
    amountPennies != null ? formatPenniesAsPounds(amountPennies) : null;

  summarySheet.addRow(["Invoice / external reference", externalRef ?? "—"]);
  summarySheet.addRow([
    "Minutes initially granted",
    minutesGranted != null ? `${minutesGranted} min` : "—",
  ]);
  summarySheet.addRow([
    "Hours initially granted",
    grantedHours != null ? `${grantedHours} h` : "—",
  ]);
  summarySheet.addRow([
    "Invoice amount",
    amountPounds != null ? amountPounds : "—",
  ]);

  // Make left column bold
  summarySheet.getColumn(1).font = { bold: true };
  summarySheet.columns = [
    { key: "label", width: 30 },
    { key: "value", width: 30 },
  ];

  // ──────────────────────────────────────────────────────────────
  // 2) Usage sheet (detailed allocations)
  // ──────────────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet("Usage");

  sheet.columns = [
    { header: "Lesson ID", key: "lessonId", width: 32 },
    { header: "Student", key: "student", width: 26 },
    { header: "Teacher", key: "teacher", width: 26 },
    { header: "Delivery", key: "delivery", width: 10 },
    { header: "SNC", key: "snc", width: 14 },
    { header: "Lesson date (London)", key: "lessonDate", width: 22 },
    { header: "Lesson length (min)", key: "lessonLength", width: 18 },
    { header: "Allocated (h)", key: "allocatedHours", width: 14 },
    {
      header: "Remaining after allocation (h)",
      key: "remainingHours",
      width: 26,
    },
  ];

  // Running remaining balance (in minutes)
  const grantedMin = minutesGranted;
  let remainingMin = grantedMin;

  for (const a of allocations) {
    const isSpliced =
      a.lesson_duration_min != null &&
      a.lesson_duration_min > 0 &&
      a.minutes_allocated < a.lesson_duration_min;

    const sncLabel = !a.lesson_is_snc
      ? "No"
      : a.lesson_snc_mode === "free"
      ? "Yes (free)"
      : a.lesson_snc_mode === "charged"
      ? "Yes (charged)"
      : "Yes";

    const lessonDate = a.lesson_occurred_at
      ? formatDateTimeLondon(a.lesson_occurred_at)
      : "—";

    const lessonLengthLabel =
      a.lesson_duration_min != null ? a.lesson_duration_min : null;

    const allocatedHours = formatMinutesAsHours(a.minutes_allocated);

    // Running remaining balance: minutes → hours
    let remainingHours: string | null = null;
    if (remainingMin != null) {
      remainingMin = remainingMin - a.minutes_allocated;
      if (remainingMin < 0) remainingMin = 0;
      remainingHours = formatMinutesAsHours(remainingMin);
    }

    sheet.addRow({
      lessonId: a.lesson_id ?? "—",
      student: a.student_full_name ?? "—",
      teacher: a.teacher_full_name ?? "—",
      delivery: a.lesson_delivery
        ? formatDeliveryLabel(a.lesson_delivery)
        : "—",
      snc: sncLabel,
      lessonDate,
      lessonLength: lessonLengthLabel,
      allocatedHours,
      remainingHours,
    });

    if (isSpliced) {
      const row = sheet.lastRow;
      const cell = row?.getCell("H"); // Allocated (h) column
      if (cell) {
        cell.note = `${a.minutes_allocated} min from this lot (lesson split across lots)`;
      }
    }
  }

  // Header row bold
  sheet.getRow(1).font = { bold: true };

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  return buffer;
}
