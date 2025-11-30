// app/(student)/student/queries/page.tsx

import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatStudentDateTime } from "@/lib/formatters";
import type { ProfileRow } from "@/lib/types/profiles";

export const dynamic = "force-dynamic";

type QueryRow = {
  id: string;
  status: string;
  body: string;
  admin_note: string | null;
  created_at: string;
  lesson_id: string | null;
  credit_lot_id: string | null;
};

export default async function StudentQueriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Even if we don't use searchParams yet, Next 16 passes it as a Promise
  await searchParams;

  const supabase = await getServerSupabase();

  // 1) Logged-in user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new Error("No authenticated student found.");
  }

  // 2) Student linked to this profile
  const { data: studentRow, error: sErr } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (sErr) throw new Error(sErr.message);

  if (!studentRow) {
    return (
      <Section
        title="My queries"
        subtitle="Questions you have raised about your lessons or credit."
      >
        <p className="text-sm text-gray-600">
          No student record is linked to this account yet. Please contact the
          administrator.
        </p>
      </Section>
    );
  }

  const studentId = studentRow.id as string;

  // 3) Profile timezone
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<ProfileRow, "timezone">>();

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  const studentTimeZone = profileRow?.timezone ?? "Europe/London";

  // 4) Fetch this student's queries (RLS will also enforce)
  const { data, error } = await supabase
    .from("student_record_queries")
    .select(
      "id, status, body, admin_note, created_at, lesson_id, credit_lot_id",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const queries = (data ?? []) as QueryRow[];

  return (
    <Section
      title="My queries"
      subtitle="Questions you have raised about your lessons or credit logs."
    >
      <p className="mb-3 text-xs text-gray-500">
        This page shows queries you have submitted. Records themselves are
        read-only; any corrections will be made by the admin team, and their
        comments will appear here.
      </p>

      {queries.length === 0 ? (
        <p className="text-sm text-gray-600">
          You haven&apos;t submitted any queries yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-600">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Your query</th>
                <th className="py-2 pr-4">Admin response</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => (
                <tr key={q.id} className="border-b align-top">
                  <td className="py-2 pr-4 text-xs text-gray-600">
                    {formatStudentDateTime(q.created_at, studentTimeZone)}
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-700">
                    {q.lesson_id ? "Lesson" : "Credit"}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">
                      {q.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-800">
                    {q.body}
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-700">
                    {q.admin_note
                      ? q.admin_note
                      : "No response added yet. The admin team will update this once reviewed."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
