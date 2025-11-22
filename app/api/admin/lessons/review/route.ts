// app/api/admin/lessons/review/route.ts

/**
 * Admin — Lesson Review API
 *
 * This endpoint powers the Admin “Review lesson” page.
 * It is READ-ONLY: no writes, no confirmation. It just assembles
 * everything the UI needs to preview a lesson before confirm/decline.
 *
 * What it returns (high level):
 * - `lesson`       → core lesson fields, including `is_snc` and `snc_mode`
 * - `lots`         → OPEN credit lots from `v_credit_lot_remaining`
 * - `studentName`  → resolved via profiles
 * - `teacherName`  → resolved via profiles
 * - `sncStats`     → per-student SNC stats from `v_student_snc_status_current_month`
 * - `studentTier`  → student.tier at time of review (basic / premium / elite / null)
 *
 * Call graph:
 *
 *   Review page
 *     → GET /api/admin/lessons/review?lessonId=…
 *         → lessons (single row)
 *         → students + profiles (name + tier)
 *         → teachers + profiles (name)
 *         → v_credit_lot_remaining (open lots)
 *         → v_student_snc_status_current_month (if is_snc = true)
 *
 * SNC business rules (implemented in SQL, NOT here):
 * - `snc_mode = 'none'`    → normal lesson (not an SNC)
 * - `snc_mode = 'free'`    → free SNC (no allocations written)
 * - `snc_mode = 'charged'` → SNC that deducts minutes
 *
 * Hazards:
 * - DB-backed hazards are exposed via v_lesson_hazards and
 *   consumed by dedicated endpoints (e.g. /api/admin/hazards/by-lesson),
 *   not through this review API. The Review page uses the LessonHazards
 *   component for hazards instead of this route.
 */

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---- Types ---------------------------------------------------------------

type Lesson = {
  id: string;
  student_id: string;
  teacher_id: string;
  occurred_at: string;
  duration_min: number;
  delivery: "online" | "f2f";
  length_cat: "none" | "60" | "90" | "120";
  state: "pending" | "confirmed" | "declined";
  is_snc: boolean;
  snc_mode: "none" | "free" | "charged";
  notes: string | null;
};

type LotRow = {
  credit_lot_id: string;
  student_id: string;
  source_type: string;
  award_reason_code: string | null;
  external_ref: string | null;
  minutes_granted: number;
  minutes_allocated: number;
  minutes_remaining: number;
  delivery_restriction: "online" | "f2f" | null;
  tier_restriction: "basic" | "standard" | "elite" | null;
  length_restriction: "none" | "60" | "90" | "120" | null;
  start_date: string;
  expiry_date: string | null;
  state: "open" | "closed" | "expired";
};

type SncStats = {
  student_id: string;
  free_sncs: number;
  charged_sncs: number;
  has_free_snc_used: boolean;
};

type Tier = "basic" | "premium" | "elite";

// profiles helper: cope with single row or array
function readFullName(p: any): string | undefined {
  if (!p) return undefined;
  return Array.isArray(p) ? p[0]?.full_name : p.full_name;
}

// ---- Handler -------------------------------------------------------------

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Normalise param names: lessonId / id (lessonId is canonical)
    const lessonId =
      url.searchParams.get("lessonId") ??
      url.searchParams.get("id") ??
      "";

    if (!lessonId) {
      return NextResponse.json(
        { error: "Missing ?lessonId" },
        { status: 400 },
      );
    }

    const supabase = getAdminSupabase();

    // 1) Fetch lesson
    const { data: lessonRow, error: lerr } = await supabase
      .from("lessons")
      .select(
        [
          "id",
          "student_id",
          "teacher_id",
          "occurred_at",
          "duration_min",
          "delivery",
          "length_cat",
          "state",
          "is_snc",
          "snc_mode",
          "notes",
        ].join(","),
      )
      .eq("id", lessonId)
      .maybeSingle();

    if (lerr) {
      return NextResponse.json({ error: lerr.message }, { status: 500 });
    }
    if (!lessonRow) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 },
      );
    }

    const lesson = lessonRow as unknown as Lesson;

    // 2) Student + teacher info (name + tier)
    const [studentRes, teacherRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, tier, profiles(full_name)")
        .eq("id", lesson.student_id)
        .maybeSingle(),
      supabase
        .from("teachers")
        .select("id, profiles(full_name)")
        .eq("id", lesson.teacher_id)
        .maybeSingle(),
    ]);

    const studentRow = studentRes.data;
    const teacherRow = teacherRes.data;

    const studentName = readFullName(studentRow?.profiles) ?? "(student)";
    const teacherName = readFullName(teacherRow?.profiles) ?? "(teacher)";

    const studentTier = (studentRow?.tier ?? null) as Tier | null;

    // 3) Open credit lots (via v_credit_lot_remaining)
    const { data: lotsRows, error: lotsErr } = await supabase
      .from("v_credit_lot_remaining")
      .select(
        [
          "credit_lot_id",
          "student_id",
          "source_type",
          "award_reason_code",
          "external_ref",
          "minutes_granted",
          "minutes_allocated",
          "minutes_remaining",
          "delivery_restriction",
          "tier_restriction",
          "length_restriction",
          "start_date",
          "expiry_date",
          "state",
        ].join(","),
      )
      .eq("student_id", lesson.student_id)
      .eq("state", "open")
      .order("start_date", { ascending: true });

    if (lotsErr) {
      return NextResponse.json(
        { error: lotsErr.message },
        { status: 500 },
      );
    }

    const lots = (lotsRows ?? []) as unknown as LotRow[];

    // 4) SNC stats (from view) – only if this lesson is marked SNC
    let sncStats: SncStats | null = null;

    if (lesson.is_snc) {
      const { data: sncRow, error: sncErr } = await supabase
        .from("v_student_snc_status_current_month")
        .select(
          "student_id, free_sncs, charged_sncs, has_free_snc_used",
        )
        .eq("student_id", lesson.student_id)
        .maybeSingle();

      if (!sncErr && sncRow) {
        sncStats = sncRow as unknown as SncStats;
      }
    }

    // 5) Return combined payload (no hazards: those are handled by dedicated endpoints)
    return NextResponse.json({
      lesson,
      lots,
      studentName,
      teacherName,
      sncStats,
      studentTier,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
