// app/api/admin/overdraft/invoice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { OverdraftSettlementResult } from "@/lib/types/credits/overdraft";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type InvoiceOverdraftArgs =
  Database["public"]["Functions"]["rpc_invoice_overdraft"]["Args"];

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
    const invoiceRef = body.invoiceRef?.trim();
    const note = body.note;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 },
      );
    }

    if (!invoiceRef) {
      return NextResponse.json(
        { error: "invoiceRef is required" },
        { status: 400 },
      );
    }

    const sb = getAdminSupabase();

    const args: InvoiceOverdraftArgs = {
      p_student_id: studentId,
      p_invoice_ref: invoiceRef,
    };

    // Generated types typically have p_note as string | undefined.
    // SQL treats NULL as "no note", so omitting the arg is equivalent.
    if (note !== null && note !== undefined && note.trim() !== "") {
      args.p_note = note;
    }

    const { data, error } = await sb.rpc("rpc_invoice_overdraft", args);

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to invoice overdraft" },
        { status: 500 },
      );
    }

    const result = data as OverdraftSettlementResult;

    // Forward the RPC JSON directly
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
