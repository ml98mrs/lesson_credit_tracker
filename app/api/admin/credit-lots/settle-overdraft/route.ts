// app/api/admin/credit-lots/settle-overdraft/route.ts

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type OverdraftRow = {
  credit_lot_id: string;
  minutes_granted: number;
  minutes_remaining: number;
  source_type: "overdraft" | string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = body?.studentId as string | undefined;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    const sb = getAdminSupabase();

    // 1) Find overdraft lot for this student with remaining minutes
    const { data, error: odErr } = await sb
      .from("v_credit_lot_remaining")
      .select(
        [
          "credit_lot_id",
          "minutes_granted",
          "minutes_remaining",
          "source_type",
        ].join(",")
      )
      .eq("student_id", studentId)
      .eq("source_type", "overdraft")
      .maybeSingle();

    if (odErr) {
      return NextResponse.json({ error: odErr.message }, { status: 500 });
    }

    const overdraft = (data as OverdraftRow | null) ?? null;

    if (!overdraft) {
      return NextResponse.json({
        ok: true,
        settled: false,
        reason: "no_overdraft_lot",
      });
    }

    const remaining = overdraft.minutes_remaining;

    if (remaining >= 0) {
      return NextResponse.json({
        ok: true,
        settled: false,
        reason: "no_negative_balance",
      });
    }

    const delta = -remaining; // positive number to add
    const previousGranted = overdraft.minutes_granted;
    const newGranted = previousGranted + delta;

    // 2) Update the underlying credit_lots row
    const { error: updErr } = await sb
      .from("credit_lots")
      .update({ minutes_granted: newGranted })
      .eq("id", overdraft.credit_lot_id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // 3) Audit log in credit_lot_events (best-effort: don't fail the whole request if this insert fails)
    await sb.from("credit_lot_events").insert({
      credit_lot_id: overdraft.credit_lot_id,
      event_type: "settle_overdraft",
      // actor_id can be null here; the SQL RPC version uses request.jwt.claim.sub,
      // but this admin route is using the service client.
      actor_id: null,
      details: {
        student_id: studentId,
        added_minutes: delta,
        previous_minutes_granted: previousGranted,
        new_minutes_granted: newGranted,
        note: "Overdraft settled via admin API",
      },
    });

    return NextResponse.json({
      ok: true,
      settled: true,
      creditLotId: overdraft.credit_lot_id,
      addedMinutes: delta,
      newMinutesGranted: newGranted,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
