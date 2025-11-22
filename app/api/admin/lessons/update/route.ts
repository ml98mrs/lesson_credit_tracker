// app/api/admin/lessons/update/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase/admin';

const Body = z.object({
  lessonId: z.string().uuid(),
  delivery: z.enum(['online', 'f2f']),
  length_cat: z.enum(['none', '60', '90', '120']),
  duration_min: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const p = Body.parse(body);

    const sb = getAdminSupabase();

// Only allow update if lesson is pending
const { data: lesson, error: readErr } = await sb
  .from("lessons")
  .select("id, state")
  .eq("id", p.lessonId)
  .single();

if (readErr || !lesson) {
  return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
}

if (lesson.state !== "pending") {
  return NextResponse.json(
    { error: `Lesson not editable (state=${lesson.state})` },
    { status: 409 }
  );
}

    const { error: updErr } = await sb
      .from('lessons')
      .update({
        delivery: p.delivery,
        length_cat: p.length_cat,
        duration_min: p.duration_min,
      })
      .eq('id', p.lessonId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }
}
