// app/api/export/allocations/[lotId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildAllocationsWorkbook } from "@/lib/xlsx/allocations";
import type { AllocationRow } from "@/components/credit/LotAllocationsTable";
import { getAdminClient } from "@/lib/api/admin/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ lotId: string }>;
}

export async function GET(
  _req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { lotId } = await context.params;
  if (!lotId) {
    return new NextResponse("Missing lotId", { status: 400 });
  }

  // Service-role admin client (no RLS)
  const supabase = getAdminClient();

  // ─────────────────────────────────────────────
  // 1) Lot meta: minutes_granted, external_ref, amount_pennies
  // ─────────────────────────────────────────────
  const { data: lotMeta, error: lotErr } = await supabase
    .from("credit_lots")
    .select(
      "minutes_granted, external_ref, amount_pennies, source_type",
    )
    .eq("id", lotId)
    .maybeSingle();

  if (lotErr) {
    console.error("credit_lots meta error", lotErr.message);
    // not fatal – we can still export allocations without meta
  }

  const minutesGranted =
    (lotMeta?.minutes_granted as number | null) ?? null;
  const externalRef = (lotMeta?.external_ref as string | null) ?? null;
  const amountPennies =
    (lotMeta?.amount_pennies as number | null) ?? null;

  // ─────────────────────────────────────────────
  // 2) Allocations for this lot
  // ─────────────────────────────────────────────
  const { data, error } = await supabase
    .from("v_lot_allocations_detail")
    .select(
      [
        "id",
        "credit_lot_id",
        "lesson_id",
        "minutes_allocated",
        "created_at",
        "lesson_occurred_at",
        "lesson_duration_min",
        "lesson_delivery",
        "lesson_is_snc",
        "lesson_snc_mode",
        "student_full_name",
        "teacher_full_name",
      ].join(","),
    )
    .eq("credit_lot_id", lotId)
    .returns<AllocationRow[]>();

  if (error) {
    console.error("allocations export error", error.message);
    return new NextResponse("Failed to fetch allocations", { status: 500 });
  }

  const allocations: AllocationRow[] = data ?? [];

  if (!allocations.length) {
    return new NextResponse("No allocations for this credit lot", {
      status: 404,
    });
  }

  // ─────────────────────────────────────────────
  // 3) Build workbook (Summary + Usage sheets)
  // ─────────────────────────────────────────────
  const buffer = await buildAllocationsWorkbook(allocations, {
    minutesGranted,
    externalRef,
    amountPennies,
  });

  // File name: prefer invoice external_ref if present
  const safeRef = externalRef?.trim().replace(/[^\w\-]/g, "_") ?? "";
  const fileName =
    safeRef.length > 0
      ? `Inv-${safeRef}_allocations.xlsx`
      : `lot-${lotId}-allocations.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
