// app/(admin)/admin/students/new/page.tsx
import { getAdminSupabase } from "@/lib/supabase/admin";
import NewStudentForm from "./NewStudentForm";

export default async function NewStudentPage() {
  const sb = getAdminSupabase();

  // Load teachers for the dropdown
  const { data: teachers, error: tErr } = await sb
    .from("teachers")
    .select("id, profile_id")
    .order("created_at", { ascending: true });

  if (tErr) {
    return (
      <p className="text-sm text-red-600">
        Error loading teachers: {tErr.message}
      </p>
    );
  }

  let teacherOptions: { id: string; name: string }[] = [];

  if (teachers && teachers.length > 0) {
    const profileIds = teachers.map((t) => t.profile_id);
    const { data: profiles, error: pErr } = await sb
      .from("profiles")
      .select("id, preferred_name, full_name")
      .in("id", profileIds);

    if (pErr) {
      return (
        <p className="text-sm text-red-600">
          Error loading teacher profiles: {pErr.message}
        </p>
      );
    }

    const nameByProfile = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        (p.preferred_name as string | null) || (p.full_name as string),
      ])
    );

    teacherOptions = teachers.map((t) => ({
      id: t.id as string,
      name:
        nameByProfile.get(t.profile_id as string) ??
        (t.id as string).slice(0, 8) + "…",
    }));
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">New student</h1>
      <p className="text-sm text-gray-600">
        Create a student account, link it to a profile and optionally assign a
        primary teacher.
      </p>
      <NewStudentForm teacherOptions={teacherOptions} />
    </div>
  );
}
