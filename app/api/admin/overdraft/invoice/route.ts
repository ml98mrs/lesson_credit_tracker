// app/api/admin/overdraft/invoice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { OverdraftSettlementResult } from "@/lib/types/credits/overdraft";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json().catch(() => ({}));

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const body = raw as {
      studentId?: string;
      invoiceRef?: string;
      note?: string | null;
    };

    const studentId = body.studentId;
    const invoiceRef = body.invoiceRef;
    const note = body.note ?? null;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 },
      );
    }

    if (!invoiceRef || !invoiceRef.trim()) {
      return NextResponse.json(
        { error: "invoiceRef is required" },
        { status: 400 },
      );
    }

    const sb = await getAdminSupabase();

    const { data, error } = await sb.rpc("rpc_invoice_overdraft", {
      p_student_id: studentId,
      p_invoice_ref: invoiceRef,
      p_note: note,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to invoice overdraft" },
        { status: 500 },
      );
    }

    const result = data as OverdraftSettlementResult;

    // Same pattern as award route – just forward the RPC JSON
    return NextResponse.json(result);
    // or, if you prefer the wrapper:
    // return NextResponse.json({ ok: true, result } as const);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
