// app/(admin)/admin/lessons/confirmed/page.tsx

import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatDateTimeLondon } from "@/lib/formatters";
import { formatLotLabel, type CreditLotSource } from "@/lib/creditLots/labels";
import { readProfileFullName, type ProfilesEmbed } from "@/lib/types/profiles";
import type {
  Delivery,
  LengthCat,
  LessonState,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

type SearchParams = {
  month?: string;
  lessonId?: string;
  studentName?: string;
  teacherName?: string;
  delivery?: string;
  fromDate?: string;
  toDate?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

type LessonRow = {
  id: string;
  student_id: string;
  teacher_id: string;
  occurred_at: string; // UTC ISO string
  duration_min: number;
  delivery: Delivery;
  length_cat: LengthCat;
  state: LessonState;
  notes: string | null;
};

type AllocRow = {
  lesson_id: string;
  credit_lot_id: string | null;
};

type LotMetaRow = {
  id: string;
  source_type: CreditLotSource;
  external_ref: string | null;
  award_reason_code: string | null;
};

type StudentRow = {
  id: string;
  profiles: ProfilesEmbed;
};

type TeacherRow = {
  id: string;
  profiles: ProfilesEmbed;
};

export default async function ConfirmedLessonsPage({ searchParams }: PageProps) {
  const sb = await getAdminSupabase();

  // Next 16: searchParams arrives as a Promise
  const sp = (searchParams ? await searchParams : {}) as SearchParams;

  const monthParam = (sp.month ?? "").trim();
  const lessonIdFilter = (sp.lessonId ?? "").trim();
  const studentNameFilterRaw = (sp.studentName ?? "").trim();
  const teacherNameFilterRaw = (sp.teacherName ?? "").trim();
  const deliveryFilter = (sp.delivery ?? "").trim(); // "f2f" | "online" | ""
  const fromDateParam = (sp.fromDate ?? "").trim();
  const toDateParam = (sp.toDate ?? "").trim();

  // --------------------------
  // Build lessons query
  // --------------------------
  let query = sb
    .from("lessons")
    .select(
      "id, student_id, teacher_id, occurred_at, duration_min, delivery, length_cat, state, notes",
    )
    .eq("state", "confirmed");

  // Date range:
  //  • If both fromDate & toDate valid → use inclusive range.
  //  • Else if month specified → use that calendar month.
  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  if (fromDateParam && toDateParam) {
    const fromCandidate = new Date(`${fromDateParam}T00:00:00.000Z`);
    const toCandidate = new Date(`${toDateParam}T00:00:00.000Z`);

    if (
      !Number.isNaN(fromCandidate.getTime()) &&
      !Number.isNaN(toCandidate.getTime()) &&
      fromCandidate <= toCandidate
    ) {
      fromDate = fromCandidate;
      // Inclusive end date: add 1 day to the "to" date
      toDate = new Date(toCandidate.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  if (!fromDate && monthParam) {
    const [yearStr, monthStr] = monthParam.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
      fromDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      toDate = new Date(Date.UTC(year, month, 1, 0, 0, 0)); // first day of next month
    }
  }

  if (fromDate && toDate) {
    query = query
      .gte("occurred_at", fromDate.toISOString())
      .lt("occurred_at", toDate.toISOString());
  }

  // Exact lesson ID filter
  if (lessonIdFilter) {
    query = query.eq("id", lessonIdFilter);
  }

  // Delivery filter
  if (deliveryFilter === "f2f" || deliveryFilter === "online") {
    query = query.eq("delivery", deliveryFilter);
  }

  const { data: lessonData, error: lessonErr } = await query
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (lessonErr) {
    throw new Error(lessonErr.message);
  }

  const lessons: LessonRow[] = (lessonData ?? []) as LessonRow[];

  // --------------------------
  // Allocations → credit lot labels (read-only)
  // --------------------------
  const lessonIds = lessons.map((l) => l.id);

  let allocRows: AllocRow[] = [];
  if (lessonIds.length > 0) {
    const { data, error } = await sb
      .from("allocations")
      .select("lesson_id, credit_lot_id")
      .in("lesson_id", lessonIds);

    if (error) {
      throw new Error(error.message);
    }

    allocRows = (data ?? []) as AllocRow[];
  }

  const creditLotIds = Array.from(
    new Set(
      allocRows
        .map((a) => a.credit_lot_id)
        .filter((id): id is string => !!id),
    ),
  );

  const lotLabelById = new Map<string, string>();

  if (creditLotIds.length > 0) {
    const { data: lotRows, error: lotErr } = await sb
      .from("credit_lots")
      .select("id, source_type, external_ref, award_reason_code")
      .in("id", creditLotIds);

    if (lotErr) {
      throw new Error(lotErr.message);
    }

    for (const lot of (lotRows ?? []) as LotMetaRow[]) {
      const label = formatLotLabel(
        lot.source_type,
        lot.external_ref,
        lot.award_reason_code,
      );
      lotLabelById.set(lot.id, label);
    }
  }

  // lesson_id → "Invoice X · Award Y" labels
  const lessonLotsLabel = new Map<string, string>();
  for (const a of allocRows) {
    if (!a.credit_lot_id) continue;
    const label = lotLabelById.get(a.credit_lot_id);
    if (!label) continue;

    const existing = lessonLotsLabel.get(a.lesson_id);
    if (!existing) {
      lessonLotsLabel.set(a.lesson_id, label);
    } else if (!existing.includes(label)) {
      lessonLotsLabel.set(a.lesson_id, `${existing} · ${label}`);
    }
  }

  // --------------------------
  // Student / teacher names via embeds + Profiles helpers
  // --------------------------
  const studentIds = Array.from(new Set(lessons.map((l) => l.student_id)));
  const teacherIds = Array.from(new Set(lessons.map((l) => l.teacher_id)));

  let studentRows: StudentRow[] = [];
  let teacherRows: TeacherRow[] = [];

  if (studentIds.length > 0) {
    const { data, error } = await sb
      .from("students")
      .select("id, profiles(full_name)")
      .in("id", studentIds);

    if (error) {
      throw new Error(error.message);
    }

    studentRows = (data ?? []) as StudentRow[];
  }

  if (teacherIds.length > 0) {
    const { data, error } = await sb
      .from("teachers")
      .select("id, profiles(full_name)")
      .in("id", teacherIds);

    if (error) {
      throw new Error(error.message);
    }

    teacherRows = (data ?? []) as TeacherRow[];
  }

  const studentNameById = new Map<string, string>();
  for (const s of studentRows) {
    const displayName =
      readProfileFullName(s.profiles) ?? `${s.id.slice(0, 8)}…`;
    studentNameById.set(s.id, displayName);
  }

  const teacherNameById = new Map<string, string>();
  for (const t of teacherRows) {
    const displayName =
      readProfileFullName(t.profiles) ?? `${t.id.slice(0, 8)}…`;
    teacherNameById.set(t.id, displayName);
  }

  // Datalist options for autocomplete
  const studentOptions = Array.from(new Set(studentNameById.values())).sort();
  const teacherOptions = Array.from(new Set(teacherNameById.values())).sort();

  // --------------------------
  // In-memory filters by *name* (human-friendly)
  // --------------------------
  const studentNameFilter = studentNameFilterRaw.toLowerCase();
  const teacherNameFilter = teacherNameFilterRaw.toLowerCase();

  const filteredLessons = lessons.filter((l) => {
    const sName = (studentNameById.get(l.student_id) ?? "").toLowerCase();
    const tName = (teacherNameById.get(l.teacher_id) ?? "").toLowerCase();

    if (studentNameFilter && !sName.includes(studentNameFilter)) {
      return false;
    }
    if (teacherNameFilter && !tName.includes(teacherNameFilter)) {
      return false;
    }
    return true;
  });

  // --------------------------
  // Render
  // --------------------------
  return (
    <Section title="Confirmed Lessons">
      <FilterForm
        month={monthParam}
        lessonId={lessonIdFilter}
        studentName={studentNameFilterRaw}
        teacherName={teacherNameFilterRaw}
        delivery={deliveryFilter}
        fromDate={fromDateParam}
        toDate={toDateParam}
        studentOptions={studentOptions}
        teacherOptions={teacherOptions}
      />

      {filteredLessons.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          No confirmed lessons match the current filters.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Date of lesson</th>
                <th className="py-2 pr-4">Lesson ID</th>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Delivery</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Credit lots</th>
                <th className="py-2 pr-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLessons.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="py-2 pr-4">
                    {formatDateTimeLondon(l.occurred_at)}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{l.id}</td>
                  <td className="py-2 pr-4">
                    {studentNameById.get(l.student_id) ??
                      `${l.student_id.slice(0, 8)}…`}
                  </td>
                  <td className="py-2 pr-4">
                    {teacherNameById.get(l.teacher_id) ??
                      `${l.teacher_id.slice(0, 8)}…`}
                  </td>
                  <td className="py-2 pr-4">
                    {l.delivery === "f2f" ? "F2F" : "Online"}
                  </td>
                  <td className="py-2 pr-4">{l.duration_min} min</td>
                  <td className="py-2 pr-4 text-xs">
                    {lessonLotsLabel.get(l.id) ?? "—"}
                  </td>
                  <td className="py-2 pr-4">{l.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// --------------------------
// Filter form (GET)
// --------------------------

type FilterFormProps = {
  month: string;
  lessonId: string;
  studentName: string;
  teacherName: string;
  delivery: string;
  fromDate: string;
  toDate: string;
  studentOptions: string[];
  teacherOptions: string[];
};

function FilterForm(props: FilterFormProps) {
  const {
    month,
    lessonId,
    studentName,
    teacherName,
    delivery,
    fromDate,
    toDate,
    studentOptions,
    teacherOptions,
  } = props;

  return (
    <>
      <form
        method="GET"
        className="grid gap-3 rounded-xl border bg-white p-3 text-xs md:grid-cols-4"
      >
        {/* Month filter */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">Month</label>
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="rounded-md border px-2 py-1"
          />
          <span className="mt-1 text-[10px] text-gray-500">
            If you set From/To dates, they override this month filter.
          </span>
        </div>

        {/* From date */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">From date</label>
          <input
            type="date"
            name="fromDate"
            defaultValue={fromDate}
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* To date */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">To date</label>
          <input
            type="date"
            name="toDate"
            defaultValue={toDate}
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* Lesson ID */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">Lesson ID</label>
          <input
            type="text"
            name="lessonId"
            defaultValue={lessonId}
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* Student name */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">Student name</label>
          <input
            type="text"
            name="studentName"
            defaultValue={studentName}
            list="studentNames"
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* Teacher name */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">Teacher name</label>
          <input
            type="text"
            name="teacherName"
            defaultValue={teacherName}
            list="teacherNames"
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* Delivery */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">Delivery</label>
          <select
            name="delivery"
            defaultValue={delivery}
            className="rounded-md border px-2 py-1"
          >
            <option value="">All</option>
            <option value="f2f">F2F</option>
            <option value="online">Online</option>
          </select>
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

      {/* Autocomplete options for names */}
      <datalist id="studentNames">
        {studentOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <datalist id="teacherNames">
        {teacherOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}
