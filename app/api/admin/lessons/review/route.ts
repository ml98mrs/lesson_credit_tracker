// app/api/admin/lessons/review/route.ts

/**
 * Admin — Lesson Review API
 *
 * This endpoint powers the Admin “Review lesson” page.
 * It is READ-ONLY: no writes, no confirmation. It just assembles
 * everything the UI needs to preview a lesson before confirm/decline.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  Delivery,
  LengthCat,
  LessonState,
  Tier,
  CreditLotState,
  DeliveryRestriction,
} from "@/lib/enums";
import {
  readProfileFullName,
  type ProfilesEmbed,
} from "@/lib/types/profiles";

export const dynamic = "force-dynamic";

// ---- Types ---------------------------------------------------------------

type Lesson = {
  id: string;
  student_id: string;
  teacher_id: string;
  occurred_at: string;
  duration_min: number;
  delivery: Delivery;
  length_cat: LengthCat;
  state: LessonState;
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
  delivery_restriction: DeliveryRestriction;
  tier_restriction: Tier | null;
  length_restriction: LengthCat | null;
  start_date: string;
  expiry_date: string | null;
  state: CreditLotState;
};

type SncStats = {
  student_id: string;
  free_sncs: number;
  charged_sncs: number;
  has_free_snc_used: boolean;
};

// ---- Handler -------------------------------------------------------------

export async function GET(req: NextRequest) {
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

    const studentRow = studentRes.data as
      | { id: string; tier: Tier | null; profiles: ProfilesEmbed }
      | null
      | undefined;

    const teacherRow = teacherRes.data as
      | { id: string; profiles: ProfilesEmbed }
      | null
      | undefined;

    const studentName =
      readProfileFullName(studentRow?.profiles) ?? "(student)";
    const teacherName =
      readProfileFullName(teacherRow?.profiles) ?? "(teacher)";

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

    // 4) SNC stats (previous-month summary) – only if this lesson is marked SNC
    let sncStats: SncStats | null = null;

    if (lesson.is_snc) {
      const { data: sncRow, error: sncErr } = await supabase
        .from("v_student_snc_status_previous_month")
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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
