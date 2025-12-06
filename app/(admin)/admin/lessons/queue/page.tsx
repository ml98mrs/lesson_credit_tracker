// app/(admin)/admin/lessons/queue/page.tsx
import Link from "next/link";
import Section from "@/components/ui/Section";
import { formatDateTimeLondon } from "@/lib/formatters";
import LessonTypeBadge from "@/components/lessons/LessonTypeBadge";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { pendingLessonsBaseQuery } from "@/lib/api/admin/lessons";
import {
  AdminLessonListRow,
  buildAdminLessonNameMaps,
} from "@/lib/domain/lessons";
import { formatDeliveryLabel } from "@/lib/domain/delivery";

export const dynamic = "force-dynamic";

// ---- Types --------------------------------------------------------------
type Lesson = AdminLessonListRow & {
  is_snc: boolean; // queue needs SNC badge
};

type SearchParams = {
  studentName?: string;
  teacherName?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

// ---- Page ---------------------------------------------------------------

export default async function PendingLessonsPage({ searchParams }: PageProps) {
  const sb = getAdminSupabase();

  // 🔹 Resolve searchParams (Next 16 passes a Promise)
  const sp = (searchParams ? await searchParams : {}) as SearchParams;
  const studentNameFilterRaw = (sp.studentName ?? "").trim();
  const teacherNameFilterRaw = (sp.teacherName ?? "").trim();

  // 1) Fetch pending lessons (including SNCs, via is_snc flag)
  const { data: lessons, error } = await pendingLessonsBaseQuery(sb).order(
    "occurred_at",
    { ascending: true },
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (lessons ?? []) as Lesson[];

  // 2) Build name maps for students & teachers (shared helper)
  const { studentNameById, teacherNameById } =
    await buildAdminLessonNameMaps(sb, rows);

  // 3) In-memory name filters (human-friendly, case-insensitive)
  const studentNameFilter = studentNameFilterRaw.toLowerCase();
  const teacherNameFilter = teacherNameFilterRaw.toLowerCase();

  const filteredRows = rows.filter((r) => {
    const sName = (studentNameById.get(r.student_id) ?? "").toLowerCase();
    const tName = (teacherNameById.get(r.teacher_id) ?? "").toLowerCase();

    if (studentNameFilter && !sName.includes(studentNameFilter)) return false;
    if (teacherNameFilter && !tName.includes(teacherNameFilter)) return false;

    return true;
  });

  return (
    <Section title="Lessons pending confirmation">
      <FilterForm
        studentName={studentNameFilterRaw}
        teacherName={teacherNameFilterRaw}
      />

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">No pending lessons 🎉</p>
      ) : filteredRows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          No pending lessons match the current filters.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Lesson ID</th>
                <th className="py-2 pr-4">Date of Lesson</th>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Delivery</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Notes</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-mono text-xs">{r.id}</td>
                  <td className="py-2 pr-4">
                    {formatDateTimeLondon(r.occurred_at)}
                  </td>
                  <td className="py-2 pr-4">
                    {studentNameById.get(r.student_id) ?? r.student_id}
                  </td>
                  <td className="py-2 pr-4">
                    {teacherNameById.get(r.teacher_id) ?? r.teacher_id}
                  </td>
                  <td className="py-2 pr-4">
                    {formatDeliveryLabel(r.delivery)}
                  </td>
                  
                  <td className="py-2 pr-4">{r.duration_min} min</td>
                  <td className="py-2 pr-4">
                    <LessonTypeBadge isSnc={r.is_snc} />
                  </td>
                  <td className="py-2 pr-4">{r.notes ?? ""}</td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/lessons/review?lessonId=${encodeURIComponent(
                        r.id,
                      )}`}
                      className="text-blue-700 underline"
                    >
                      Review &amp; confirm
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

// ---- Simple name filter form (GET) --------------------------------------

function FilterForm(props: { studentName: string; teacherName: string }) {
  const { studentName, teacherName } = props;

  return (
    <form
      method="GET"
      className="grid gap-3 rounded-xl border bg-white p-3 text-xs md:grid-cols-3"
    >
      <div className="flex flex-col">
        <label className="mb-1 font-medium">Student name</label>
        <input
          type="text"
          name="studentName"
          defaultValue={studentName}
          className="rounded-md border px-2 py-1"
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 font-medium">Teacher name</label>
        <input
          type="text"
          name="teacherName"
          defaultValue={teacherName}
          className="rounded-md border px-2 py-1"
        />
      </div>

      <div className="flex items-end">
        <button
          type="submit"
          className="inline-flex rounded-md border border-black bg-black px-4 py-1.5 text-xs font-medium text-white"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}
