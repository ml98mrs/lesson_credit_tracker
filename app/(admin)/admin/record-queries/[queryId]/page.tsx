// app/(admin)/admin/record-queries/[queryId]/page.tsx
import { notFound } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabase/admin";
import Section from "@/components/ui/Section";
import AdminRecordQueryForm from "./_AdminRecordQueryForm";
import { formatDateTimeLondon } from "@/lib/formatters";
import type { ProfilesEmbed } from "@/lib/types/profiles";
import { readProfileFullName } from "@/lib/types/profiles";

type AdminRecordQueryFormProps = React.ComponentProps<typeof AdminRecordQueryForm>;
type Status = AdminRecordQueryFormProps["initialStatus"];

export const dynamic = "force-dynamic";

type Params = { queryId: string };

type QueryRow = {
  id: string;
  status: Status;
  body: string;
  resolution_code: string | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  lesson_id: string | null;
  credit_lot_id: string | null;
  students: {
    id: string;
    profiles: ProfilesEmbed | null;
  } | null;
};




export default async function AdminRecordQueryDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { queryId } = await params; // ✅ unwrap

  const supabase = await getAdminSupabase();

  const { data, error } = await supabase
    .from("student_record_queries")
    .select(
      `
        id,
        status,
        body,
        resolution_code,
        admin_note,
        created_at,
        resolved_at,
        lesson_id,
        credit_lot_id,
        students (
          id,
          profiles ( full_name )
        )
      `,
    )
    .eq("id", queryId)
    .maybeSingle<QueryRow>();

  if (error) throw new Error(error.message);
  if (!data) notFound();

  const studentName =
  (data.students?.profiles &&
    readProfileFullName(data.students.profiles)) ??
  data.students?.id ??
  "Unknown student";



  return (
    <Section
      title="Student query"
      subtitle="Review and respond to a student’s question about their record."
    >
      <div className="mb-4 text-xs text-gray-600">
        <p>
          <span className="font-semibold">Student:</span> {studentName}
        </p>
        <p>
  <span className="font-semibold">Created:</span>{" "}
  {formatDateTimeLondon(data.created_at)}
</p>

        <p>
          <span className="font-semibold">Type:</span>{" "}
          {data.lesson_id ? "Lesson" : "Credit"}
        </p>
      </div>

      <div className="mb-4 rounded border bg-gray-50 p-3 text-sm">
        <p className="mb-1 font-semibold">Student message</p>
        <p className="whitespace-pre-wrap text-gray-800">{data.body}</p>
      </div>

      <AdminRecordQueryForm
        queryId={data.id}
        initialStatus={data.status}
        initialAdminNote={data.admin_note ?? ""}
        initialResolutionCode={data.resolution_code ?? ""}
      />
    </Section>
  );
}
