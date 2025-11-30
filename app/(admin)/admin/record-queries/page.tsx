// app/(admin)/admin/record-queries/page.tsx
import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import Section from "@/components/ui/Section";

type Row = {
  id: string;
  status: string;
  created_at: string;
  body: string;
  lesson_id: string | null;
  credit_lot_id: string | null;
  student_id: string;
  student_full_name: string | null;
};

export const dynamic = "force-dynamic";

export default async function AdminRecordQueriesPage() {
  const supabase = await getAdminSupabase();

  // join student name via profiles if you have a view, adjust as needed
  const { data, error } = await supabase
    .from("student_record_queries")
    .select(
      `
        id,
        status,
        created_at,
        body,
        lesson_id,
        credit_lot_id,
        student_id,
        students (
          id,
          profiles ( full_name )
        )
      `,
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows: Row[] =
    data?.map((row: any) => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      body: row.body,
      lesson_id: row.lesson_id,
      credit_lot_id: row.credit_lot_id,
      student_id: row.student_id,
      student_full_name: row.students?.profiles?.full_name ?? null,
    })) ?? [];

  return (
    <Section
      title="Student queries"
      subtitle="Questions raised by students about their lessons or credit logs."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No queries yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-600">
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Preview</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-b">
                  <td className="py-2 pr-4 text-xs text-gray-600">
                    {new Date(q.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    <Link
                      href={`/admin/students/${q.student_id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {q.student_full_name ?? q.student_id}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-700">
                    {q.lesson_id ? "Lesson" : "Credit"}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      {q.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-700">
                    {q.body.length > 60
                      ? q.body.slice(0, 57) + "…"
                      : q.body}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    <Link
                      href={`/admin/record-queries/${q.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      View
                    </Link>
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
