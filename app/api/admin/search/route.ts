// app/api/admin/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  q: z.string().min(1).max(100),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = { q: searchParams.get("q") ?? "" };

    const parsed = QuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { students: [], teachers: [], invoices: [], debug: "bad query" },
        { status: 400 }
      );
    }

    const q = parsed.data.q.trim();
    if (!q) {
      return NextResponse.json({
        students: [],
        teachers: [],
        invoices: [],
        debug: "empty query",
      });
    }

    const sb = getAdminSupabase();

    // --- 1) profiles for students / teachers (search by name) ---------------
    const studentsProfilesPromise = sb
      .from("profiles")
      .select("id, full_name, preferred_name")
      .eq("role", "student")
      .or(
        `full_name.ilike.%${q}%,preferred_name.ilike.%${q}%`
      )
      .limit(10);

    const teachersProfilesPromise = sb
      .from("profiles")
      .select("id, full_name, preferred_name")
      .eq("role", "teacher")
      .or(
        `full_name.ilike.%${q}%,preferred_name.ilike.%${q}%`
      )
      .limit(10);

    const [studentsProfilesRes, teachersProfilesRes] = await Promise.all([
      studentsProfilesPromise,
      teachersProfilesPromise,
    ]);

    if (studentsProfilesRes.error || teachersProfilesRes.error) {
      const debug = {
        studentsProfilesError: studentsProfilesRes.error?.message ?? null,
        teachersProfilesError: teachersProfilesRes.error?.message ?? null,
      };
      console.error("Admin search profile error", debug);
      return NextResponse.json(
        { students: [], teachers: [], invoices: [], debug },
        { status: 500 }
      );
    }

    const studentProfiles = studentsProfilesRes.data ?? [];
    const teacherProfiles = teachersProfilesRes.data ?? [];

    // --- 2) map profiles → students/teachers via profile_id ------------------
    const studentProfileIds = studentProfiles.map((p) => p.id);
    const teacherProfileIds = teacherProfiles.map((p) => p.id);

    const [{ data: studentRows, error: sErr }, { data: teacherRows, error: tErr }] =
      await Promise.all([
        studentProfileIds.length
          ? sb
              .from("students")
              .select("id, profile_id")
              .in("profile_id", studentProfileIds)
          : Promise.resolve({ data: [], error: null }),
        teacherProfileIds.length
          ? sb
              .from("teachers")
              .select("id, profile_id")
              .in("profile_id", teacherProfileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (sErr || tErr) {
      const debug = {
        studentsError: sErr?.message ?? null,
        teachersError: tErr?.message ?? null,
      };
      console.error("Admin search student/teacher join error", debug);
      return NextResponse.json(
        { students: [], teachers: [], invoices: [], debug },
        { status: 500 }
      );
    }

    const studentIdByProfile = new Map<string, string>();
    (studentRows ?? []).forEach((s: any) => {
      studentIdByProfile.set(s.profile_id as string, s.id as string);
    });

    const teacherIdByProfile = new Map<string, string>();
    (teacherRows ?? []).forEach((t: any) => {
      teacherIdByProfile.set(t.profile_id as string, t.id as string);
    });

    const students = studentProfiles
      .map((p: any) => {
        const sid = studentIdByProfile.get(p.id as string);
        if (!sid) return null; // profile with no student row – skip
        const name =
          (p.preferred_name as string | null) ||
          (p.full_name as string) ||
          "—";
        return { id: sid, name };
      })
      .filter(Boolean) as { id: string; name: string }[];

    const teachers = teacherProfiles
      .map((p: any) => {
        const tid = teacherIdByProfile.get(p.id as string);
        if (!tid) return null;
        const name =
          (p.preferred_name as string | null) ||
          (p.full_name as string) ||
          "—";
        return { id: tid, name };
      })
      .filter(Boolean) as { id: string; name: string }[];

    // --- 3) Invoice search (unchanged) --------------------------------------
    const isLikelyInvoiceNumber = /^\d{4,}$/.test(q);
    const qNorm = q.toUpperCase();

    let invoicesRes:
      | { data: any[] | null; error: null }
      | { data: null; error: any } = { data: [], error: null };

    if (isLikelyInvoiceNumber) {
      invoicesRes = await sb
        .from("credit_lots")
        .select("id, student_id, external_ref, external_ref_norm, source_type")
        .eq("source_type", "invoice")
        .ilike("external_ref_norm", `%${qNorm}%`)
        .order("external_ref_norm", { ascending: true })
        .limit(5);
    }

    if (invoicesRes.error) {
      const debug = { invoicesError: invoicesRes.error.message };
      console.error("Admin search invoice error", debug);
      return NextResponse.json(
        { students: [], teachers: [], invoices: [], debug },
        { status: 500 }
      );
    }

    const invoices = (invoicesRes.data ?? []).map((lot: any) => ({
      id: lot.id as string,
      invoiceRef:
        (lot.external_ref as string | null) ??
        (lot.external_ref_norm as string | null) ??
        "",
      studentId: lot.student_id as string,
      studentName: null as string | null,
    }));

    return NextResponse.json({ students, teachers, invoices, debug: null });
  } catch (err: any) {
    console.error("Admin search unexpected error", err);
    return NextResponse.json(
      {
        students: [],
        teachers: [],
        invoices: [],
        debug: err?.message ?? "unexpected error",
      },
      { status: 500 }
    );
  }
}
