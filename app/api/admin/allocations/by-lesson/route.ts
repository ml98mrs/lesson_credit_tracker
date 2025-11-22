export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId") ?? "";
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("allocations")
    .select(`
      id,
      lesson_id,
      credit_lot_id,
      minutes_allocated,
      credit_lots (
        source_type,
        external_ref,
        award_reason_code
      )
    `)
    .eq("lesson_id", lessonId)
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    allocations: (data ?? []).map((row: any) => ({
      id: row.id,
      lesson_id: row.lesson_id,
      credit_lot_id: row.credit_lot_id,
      minutes_allocated: row.minutes_allocated,
      source_type: row.credit_lots?.source_type ?? null,
      external_ref: row.credit_lots?.external_ref ?? null,
      award_reason_code: row.credit_lots?.award_reason_code ?? null,
    })),
  });
}
