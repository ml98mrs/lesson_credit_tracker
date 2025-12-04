// lib/types/analytics.ts

import type { LessonMarginRow } from "@/lib/types/views/analytics";

// Aggregated teacher × month summary row (derived from lessons)
export type TeacherSummaryRow = {
  teacher_id: string;
  teacher_name: string | null;
  month_start: string;
  lesson_minutes_total: number;
  revenue_pennies: number;
  teacher_earnings_pennies: number;
  drinks_allocated_pennies: number;
  margin_before_drinks_pennies: number;
  margin_after_drinks_pennies: number;
  margin_before_drinks_pct: number | null;
  margin_after_drinks_pct: number | null;
  tiers: string[];
  lengthCats: string[];
};

/**
 * Build teacher × month summaries from lesson-level margin rows.
 * Mirrors the aggregation logic that was previously in the report page.
 */
export function buildTeacherSummary(
  lessonRows: LessonMarginRow[],
): TeacherSummaryRow[] {
  const teacherMap = new Map<string, TeacherSummaryRow>();

  for (const row of lessonRows) {
    const key = `${row.teacher_id}-${row.month_start}`;

    let summary = teacherMap.get(key);
    if (!summary) {
      summary = {
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        month_start: row.month_start,
        lesson_minutes_total: 0,
        revenue_pennies: 0,
        teacher_earnings_pennies: 0,
        drinks_allocated_pennies: 0,
        margin_before_drinks_pennies: 0,
        margin_after_drinks_pennies: 0,
        margin_before_drinks_pct: null,
        margin_after_drinks_pct: null,
        tiers: [],
        lengthCats: [],
      };
      teacherMap.set(key, summary);
    }

    const rev = row.revenue_pennies ?? 0;
    const earn = row.teacher_earnings_pennies ?? 0;
    const mb = row.margin_before_drinks_pennies ?? 0;
    const da = row.drinks_allocated_pennies ?? 0;
    const ma = row.margin_after_drinks_pennies ?? 0;

    summary.lesson_minutes_total += row.duration_min ?? 0;
    summary.revenue_pennies += rev;
    summary.teacher_earnings_pennies += earn;
    summary.drinks_allocated_pennies += da;
    summary.margin_before_drinks_pennies += mb;
    summary.margin_after_drinks_pennies += ma;

    if (row.student_tier && !summary.tiers.includes(row.student_tier)) {
      summary.tiers.push(row.student_tier);
    }
    if (row.length_cat && !summary.lengthCats.includes(row.length_cat)) {
      summary.lengthCats.push(row.length_cat);
    }
  }

  const teacherRows = Array.from(teacherMap.values()).map((row) => {
    if (row.revenue_pennies > 0) {
      row.margin_before_drinks_pct =
        (row.margin_before_drinks_pennies * 100) / row.revenue_pennies;
      row.margin_after_drinks_pct =
        (row.margin_after_drinks_pennies * 100) / row.revenue_pennies;
    } else {
      row.margin_before_drinks_pct = null;
      row.margin_after_drinks_pct = null;
    }
    return row;
  });

  // Same sort as before: latest month first, then teacher name
  teacherRows.sort((a, b) => {
    if (a.month_start < b.month_start) return 1;
    if (a.month_start > b.month_start) return -1;
    if ((a.teacher_name ?? "") < (b.teacher_name ?? "")) return -1;
    if ((a.teacher_name ?? "") > (b.teacher_name ?? "")) return 1;
    return 0;
  });

  return teacherRows;
}
