import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

// Simple YYYY-MM-DD check
const ISO_DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const InvoiceSchema = z.object({
  studentId: z.string().uuid(),
  externalRef: z.string().min(1),
  minutesGranted: z.number().int().positive(),
  startDate: ISO_DATE,

  // delivery is enum ('online','f2f')
  deliveryRestriction: z.enum(["online", "f2f"]).nullable().optional(),
  tierRestriction: z.string().min(1).nullable().optional(),
  lengthRestriction: z
    .enum(["none", "60", "90", "120"])
    .optional()
    .default("none"),

  expiryDate: ISO_DATE.nullable().optional(),
  expiryPolicy: z
    .enum(["none", "advisory", "mandatory"])
    .optional()
    .default("none"),

  lessonsPerMonth: z.number().int().positive().nullable().optional(),
  durationPerLessonMins: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  buffer: z.number().nonnegative().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request",
          issues: parsed.error.flatten(),
        },
        { status: 422 }
      );
    }

    const p = parsed.data;
    const supabase = getAdminSupabase();

    const { data, error } = await supabase.rpc("rpc_import_invoice", {
      p_student_id: p.studentId,
      p_external_ref: p.externalRef,
      p_minutes_granted: p.minutesGranted,
      p_start_date: p.startDate,

      p_delivery_restriction: p.deliveryRestriction ?? null,
      p_tier_restriction: p.tierRestriction ?? null,
      p_length_restriction: p.lengthRestriction,
      p_expiry_date: p.expiryDate ?? null,
      p_expiry_policy: p.expiryPolicy,

      p_lessons_per_month: p.lessonsPerMonth ?? null,
      p_duration_per_lesson_mins: p.durationPerLessonMins ?? null,
      p_buffer: p.buffer ?? null,
    });

    if (error) {
      // rpc_import_invoice raises with human-readable messages
      return NextResponse.json(
        {
          ok: false,
          error: error.message ?? "Error importing invoice",
        },
        { status: 400 }
      );
    }

    const lot = data as { id?: string } | null;
    const creditLotId = lot?.id;

    if (!creditLotId) {
      // Very unlikely, but keep contract explicit
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invoice import did not return a credit lot. Please contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        creditLotId,
        lot,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
