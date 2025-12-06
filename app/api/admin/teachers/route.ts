// app/api/admin/teachers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

const BodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),// app/api/admin/credit-lots/import-invoice/route.ts
  
  preferredName: z.string().optional(),
  timezone: z.string().default("Europe/London"),
});

type AdminCreateTeacherArgs =
  Database["public"]["Functions"]["rpc_admin_create_teacher"]["Args"];

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);

    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, fullName, preferredName, timezone } = parsed.data;

    const sb = getAdminSupabase();

    // 1) Create auth user
    const { data: userRes, error: userErr } =
      await sb.auth.admin.createUser({
        email,
        email_confirm: false,
      });

    if (userErr || !userRes?.user) {
      console.error(
        "Create teacher: auth.admin.createUser failed",
        userErr,
      );
      return NextResponse.json(
        {
          error: "Failed to create auth user",
          details: userErr?.message ?? "Unknown auth error",
        },
        { status: 500 },
      );
    }

    const authUserId = userRes.user.id;

    // 2) Create profile + teacher via RPC
    const rpcArgs: AdminCreateTeacherArgs = {
  p_auth_user_id: authUserId,
  p_full_name: fullName,
  // DB types want a string; function can treat "" as NULL via nullif(...)
  p_preferred_name: preferredName ?? "",
  p_timezone: timezone,
};


    const { data: rpcData, error: rpcErr } = await sb.rpc(
      "rpc_admin_create_teacher",
      rpcArgs,
    );

    if (rpcErr) {
      console.error(
        "Create teacher: rpc_admin_create_teacher failed",
        rpcErr,
      );
      return NextResponse.json(
        {
          error: "Failed to create teacher in DB",
          details: rpcErr.message,
        },
        { status: 500 },
      );
    }

    const teacherId = rpcData as string | null;

    if (!teacherId) {
      console.error(
        "Create teacher: rpc_admin_create_teacher returned no id",
        rpcData,
      );
      return NextResponse.json(
        {
          error: "Teacher created but no ID returned",
          details:
            "The SQL function rpc_admin_create_teacher did not return a UUID.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ teacherId }, { status: 201 });
  } catch (err: unknown) {
    console.error("Create teacher: unexpected server error", err);

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
