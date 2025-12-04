// app/api/admin/students/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { TIER } from "@/lib/enums";

const BodySchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(1),
  preferredName: z.string().trim().nullable().optional(),
  timezone: z.string().default("Europe/London"),
  tier: z.enum(TIER).nullable().optional(),
  teacherId: z.string().uuid().nullable().optional(),
});


export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);

    const parsed = BodySchema.safeParse(json);
if (!parsed.success) {
  const flat = parsed.error.flatten();
  const firstFormError = flat.formErrors[0];
  const firstFieldError = Object.values(flat.fieldErrors)[0]?.[0];

  return NextResponse.json(
    {
      error: "Invalid body",
      details: firstFormError || firstFieldError || "Invalid request payload",
    },
    { status: 400 }
  );
}

    const { email, fullName, preferredName, timezone, tier, teacherId } =
      parsed.data;

    const sb = getAdminSupabase();

    // 1) Create auth user
    const { data: userRes, error: userErr } = await sb.auth.admin.createUser({
      email,
      email_confirm: false,
    });

    if (userErr || !userRes?.user) {
      console.error("Create student: auth.admin.createUser failed", userErr);
      return NextResponse.json(
        {
          error: "Failed to create auth user",
          details: userErr?.message ?? "Unknown auth error",
        },
        { status: 500 }
      );
    }

    const authUserId = userRes.user.id;

    // 2) Create profile + student + pairing via RPC
    const { data: rpcData, error: rpcErr } = await sb.rpc(
      "rpc_admin_create_student",
      {
        p_auth_user_id: authUserId,
        p_full_name: fullName,
        p_preferred_name: preferredName ?? null,
        p_timezone: timezone,
        p_tier: tier ?? null,
        p_teacher_id: teacherId ?? null,
      }
    );

    if (rpcErr) {
  console.error("Create student: rpc_admin_create_student failed", rpcErr);

  try {
    await sb.auth.admin.deleteUser(authUserId);
  } catch (cleanupErr) {
    console.error(
      "Create student: failed to delete orphan auth user",
      cleanupErr
    );
  }

  return NextResponse.json(
    {
      error: "Failed to create student in DB",
      details: rpcErr.message,
    },
    { status: 500 }
  );
}


    const studentId = rpcData as string | null;

    if (!studentId) {
      console.error(
        "Create student: rpc_admin_create_student returned no studentId",
        rpcData
      );
      return NextResponse.json(
        {
          error: "Student created but no ID returned",
          details:
            "The SQL function rpc_admin_create_student did not return a UUID.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ studentId }, { status: 201 });
  } catch (err: unknown) {
  console.error("Create student: unexpected server error", err);

  if (err instanceof Error) {
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: err.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      error: "Unexpected server error",
      details: String(err),
    },
    { status: 500 },
  );
}

}
