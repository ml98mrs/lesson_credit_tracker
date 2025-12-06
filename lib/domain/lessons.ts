// lib/domain/lessons.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Delivery, LengthCat, LessonState } from "@/lib/enums";
import type { ProfilesEmbed } from "@/lib/types/profiles";
import { readProfileFullName } from "@/lib/types/profiles";
import { formatDeliveryLabel as formatDeliveryLabelDelivery } from "@/lib/domain/delivery";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * Core shape for admin-facing lesson lists.
 * Individual views (queue, confirmed, etc.) can extend this.
 */
export type AdminLessonListRow = {
  id: string;
  student_id: string;
  teacher_id: string;
  occurred_at: string; // UTC ISO string
  duration_min: number;
  delivery: Delivery;
  length_cat: LengthCat;
  state: LessonState;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Human-friendly label for delivery mode.
 * Keeps "F2F / Online" consistent across the app.
 * Delegates to the canonical delivery domain helper.
 */
export const formatDeliveryLabel = (delivery: Delivery): string =>
  formatDeliveryLabelDelivery(delivery);

/**
 * Human-friendly label for lesson length category (LengthCat).
 *
 * IMPORTANT:
 *  - This is a categorical label, not the actual duration.
 *  - It must never fall back to duration_min.
 */
export function formatLessonLength(lengthCat: LengthCat): string {
  switch (lengthCat) {
    case "60":
      return "60-min slot";
    case "90":
      return "90-min slot";
    case "120":
      return "120-min slot";
    case "none":
    default:
      return "—"; // no categorical length set for this lesson
  }
}


/**
 * Human-friendly label for lesson state.
 * Keep this in sync with admin UI copy.
 */
export function formatLessonState(state: LessonState): string {
  switch (state) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "declined":
      return "Declined";
  }
}

// ---------------------------------------------------------------------------
// Name-map helpers
// ---------------------------------------------------------------------------

export type AdminLessonNameMaps = {
  studentNameById: Map<string, string>;
  teacherNameById: Map<string, string>;
};

/**
 * Given a Supabase client and a set of lessons, load student/teacher names
 * via profiles and return name maps keyed by ID.
 *
 * Fallback display name: first 8 chars of UUID (e.g. "1234abcd…").
 */
export async function buildAdminLessonNameMaps<
  T extends Pick<AdminLessonListRow, "student_id" | "teacher_id">,
>(
  sb: SupabaseClient,
  lessons: T[],
): Promise<AdminLessonNameMaps> {
  const studentIds = Array.from(new Set(lessons.map((l) => l.student_id)));
  const teacherIds = Array.from(new Set(lessons.map((l) => l.teacher_id)));

  const studentNameById = new Map<string, string>();
  const teacherNameById = new Map<string, string>();

  if (studentIds.length > 0) {
    const { data, error } = await sb
      .from("students")
      .select("id, profiles(full_name)")
      .in("id", studentIds);

    if (error) {
      throw new Error(error.message);
    }

    (data ?? []).forEach((row: { id: string; profiles: ProfilesEmbed }) => {
      const displayName =
        readProfileFullName(row.profiles) ?? `${row.id.slice(0, 8)}…`;
      studentNameById.set(row.id, displayName);
    });
  }

  if (teacherIds.length > 0) {
    const { data, error } = await sb
      .from("teachers")
      .select("id, profiles(full_name)")
      .in("id", teacherIds);

    if (error) {
      throw new Error(error.message);
    }

    (data ?? []).forEach((row: { id: string; profiles: ProfilesEmbed }) => {
      const displayName =
        readProfileFullName(row.profiles) ?? `${row.id.slice(0, 8)}…`;
      teacherNameById.set(row.id, displayName);
    });
  }

  return { studentNameById, teacherNameById };
}

// ---------------------------------------------------------------------------
// Name options (for filters / datalists)
// ---------------------------------------------------------------------------

export type AdminNameOptions = {
  studentOptions: string[];
  teacherOptions: string[];
};

/**
 * Build sorted, de-duplicated lists of student/teacher names suitable for
 * <datalist> options on admin filters.
 */
export function buildAdminNameOptionsFromMaps(
  maps: AdminLessonNameMaps,
): AdminNameOptions {
  const { studentNameById, teacherNameById } = maps;

  return {
    studentOptions: Array.from(new Set(studentNameById.values())).sort(
  (a, b) => a.localeCompare(b, "en", { sensitivity: "base" }),
),
teacherOptions: Array.from(new Set(teacherNameById.values())).sort(
  (a, b) => a.localeCompare(b, "en", { sensitivity: "base" }),
),
  };
}

// ---------------------------------------------------------------------------
// Date-range helpers (for lesson filters)
// ---------------------------------------------------------------------------

/**
 * Resulting UTC range for lesson queries.
 * fromIso: inclusive lower bound
 * toExclusiveIso: exclusive upper bound (typically next day / next month)
 */
export type LessonDateRange = {
  fromIso: string | null;
  toExclusiveIso: string | null;
};

export type LessonDateRangeParams = {
  /**
   * Calendar month in "YYYY-MM" form, e.g. "2025-11".
   * Used only if explicit from/to are not both valid.
   */
  monthParam?: string | null;
  /**
   * Lower bound date in "YYYY-MM-DD" (UI value). Optional.
   */
  fromDateParam?: string | null;
  /**
   * Upper bound date in "YYYY-MM-DD" (UI value). Optional.
   * Treated as inclusive in the UI, but we convert to an exclusive bound
   * by adding one day.
   */
  toDateParam?: string | null;
};

/**
 * Shared logic for lesson date filters.
 *
 * Rules:
 *  - If BOTH fromDate & toDate are valid and from <= to:
 *      → use that range (inclusive in UI, exclusive bound internally).
 *  - ELSE IF monthParam is a valid "YYYY-MM":
 *      → use that whole calendar month (UTC).
 *  - ELSE:
 *      → no date filter (both null).
 */
export function computeLessonDateRange(
  params: LessonDateRangeParams,
): LessonDateRange {
  const rawFrom = (params.fromDateParam ?? "").trim();
  const rawTo = (params.toDateParam ?? "").trim();
  const rawMonth = (params.monthParam ?? "").trim();

  let fromDate: Date | null = null;
  let toExclusiveDate: Date | null = null;

  // 1) Explicit from/to (UI inclusive)
  if (rawFrom && rawTo) {
    const fromCandidate = new Date(`${rawFrom}T00:00:00.000Z`);
    const toCandidate = new Date(`${rawTo}T00:00:00.000Z`);

    if (
      !Number.isNaN(fromCandidate.getTime()) &&
      !Number.isNaN(toCandidate.getTime()) &&
      fromCandidate <= toCandidate
    ) {
      fromDate = fromCandidate;
      // Inclusive → exclusive: add 1 day to "to" date
      toExclusiveDate = new Date(
        toCandidate.getTime() + 24 * 60 * 60 * 1000,
      );
    }
  }

  // 2) Month fallback
  if (!fromDate && rawMonth) {
    const [yearStr, monthStr] = rawMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr); // 1–12

    if (
      !Number.isNaN(year) &&
      !Number.isNaN(month) &&
      month >= 1 &&
      month <= 12
    ) {
      fromDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      toExclusiveDate = new Date(Date.UTC(year, month, 1, 0, 0, 0)); // first day of next month
    }
  }

  return {
    fromIso: fromDate ? fromDate.toISOString() : null,
    toExclusiveIso: toExclusiveDate ? toExclusiveDate.toISOString() : null,
  };
}
