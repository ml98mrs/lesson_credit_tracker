// app/(admin)/admin/students/new/page.tsx
import { getAdminSupabase } from "@/lib/supabase/admin";
import { readProfileDisplayName } from "@/lib/types/profiles";
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

    const nameByProfile = new Map<string, string>(
      (profiles ?? []).map((p) => {
        const id = p.id as string;
        const profileObj = {
          full_name: p.full_name as string | null,
          preferred_name: p.preferred_name as string | null,
        };

        const displayName =
          readProfileDisplayName(profileObj, id.slice(0, 8) + "…") ??
          id.slice(0, 8) + "…";

        return [id, displayName];
      }),
    );

    teacherOptions = teachers.map((t) => {
      const id = t.id as string;
      const label =
        nameByProfile.get(t.profile_id as string) ?? id.slice(0, 8) + "…";

      return { id, name: label };
    });
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
