// app/(admin)/admin/lessons/confirmed/page.tsx

import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatDateTimeLondon } from "@/lib/formatters";
import { formatLotLabel } from "@/lib/creditLots/labels";
import type { CreditLotSource } from "@/lib/creditLots/types";
import {
  AdminLessonListRow,
  buildAdminLessonNameMaps,
  buildAdminNameOptionsFromMaps,
  computeLessonDateRange,
} from "@/lib/domain/lessons";
import { DELIVERY } from "@/lib/enums";
import {
  formatDeliveryLabel,
  formatDeliveryUiLabel,
} from "@/lib/domain/delivery";

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

type LessonRow = AdminLessonListRow;

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

type NormalizedFilters = {
  monthParam: string;
  lessonIdFilter: string;
  studentNameFilterRaw: string;
  teacherNameFilterRaw: string;
  deliveryFilter: string;
  fromDateParam: string;
  toDateParam: string;
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function normalizeFilters(sp: SearchParams | undefined): NormalizedFilters {
  const safe = sp ?? {};
  const trim = (v?: string) => (v ?? "").trim();

  return {
    monthParam: trim(safe.month),
    lessonIdFilter: trim(safe.lessonId),
    studentNameFilterRaw: trim(safe.studentName),
    teacherNameFilterRaw: trim(safe.teacherName),
    deliveryFilter: trim(safe.delivery),
    fromDateParam: trim(safe.fromDate),
    toDateParam: trim(safe.toDate),
  };
}

async function fetchConfirmedLessons(
  sb: Awaited<ReturnType<typeof getAdminSupabase>>,
  filters: NormalizedFilters,
): Promise<LessonRow[]> {
  const {
    monthParam,
    lessonIdFilter,
    deliveryFilter,
    fromDateParam,
    toDateParam,
  } = filters;

  let query = sb
    .from("lessons")
    .select(
      "id, student_id, teacher_id, occurred_at, duration_min, delivery, length_cat, state, notes",
    )
    .eq("state", "confirmed");

  const { fromIso, toExclusiveIso } = computeLessonDateRange({
    monthParam,
    fromDateParam,
    toDateParam,
  });

  if (fromIso && toExclusiveIso) {
    query = query.gte("occurred_at", fromIso).lt("occurred_at", toExclusiveIso);
  }

  if (lessonIdFilter) {
    query = query.eq("id", lessonIdFilter);
  }

  if (deliveryFilter === "f2f" || deliveryFilter === "online") {
    query = query.eq("delivery", deliveryFilter);
  }

  const { data: lessonData, error: lessonErr } = await query
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (lessonErr) {
    throw new Error(lessonErr.message);
  }

  return (lessonData ?? []) as LessonRow[];
}

async function fetchLessonLotsLabel(
  sb: Awaited<ReturnType<typeof getAdminSupabase>>,
  lessons: LessonRow[],
): Promise<Map<string, string>> {
  const lessonIds = lessons.map((l) => l.id);
  const lessonLotsLabel = new Map<string, string>();

  if (lessonIds.length === 0) return lessonLotsLabel;

  const { data: allocData, error: allocErr } = await sb
    .from("allocations")
    .select("lesson_id, credit_lot_id")
    .in("lesson_id", lessonIds);

  if (allocErr) {
    throw new Error(allocErr.message);
  }

  const allocRows = (allocData ?? []) as AllocRow[];

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

  return lessonLotsLabel;
}

function filterLessonsByName(
  lessons: LessonRow[],
  studentNameById: Map<string, string>,
  teacherNameById: Map<string, string>,
  studentNameFilterRaw: string,
  teacherNameFilterRaw: string,
): LessonRow[] {
  const studentNameFilter = studentNameFilterRaw.toLowerCase();
  const teacherNameFilter = teacherNameFilterRaw.toLowerCase();

  return lessons.filter((l) => {
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
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default async function ConfirmedLessonsPage({ searchParams }: PageProps) {
  const sb = await getAdminSupabase();

  // Next 16: searchParams arrives as a Promise
  const sp = searchParams ? await searchParams : {};
  const filters = normalizeFilters(sp as SearchParams);

  const lessons = await fetchConfirmedLessons(sb, filters);

  const [lessonLotsLabel, nameMaps] = await Promise.all([
    fetchLessonLotsLabel(sb, lessons),
    buildAdminLessonNameMaps(sb, lessons),
  ]);

  const { studentNameById, teacherNameById } = nameMaps;
  const { studentOptions, teacherOptions } =
    buildAdminNameOptionsFromMaps(nameMaps);

  const filteredLessons = filterLessonsByName(
    lessons,
    studentNameById,
    teacherNameById,
    filters.studentNameFilterRaw,
    filters.teacherNameFilterRaw,
  );

  const {
    monthParam,
    lessonIdFilter,
    studentNameFilterRaw,
    teacherNameFilterRaw,
    deliveryFilter,
    fromDateParam,
    toDateParam,
  } = filters;

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
                    {formatDeliveryLabel(l.delivery)}
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
          <label htmlFor="month" className="mb-1 font-medium">
            Month
          </label>
          <input
            id="month"
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
          <label htmlFor="fromDate" className="mb-1 font-medium">
            From date
          </label>
          <input
            id="fromDate"
            type="date"
            name="fromDate"
            defaultValue={fromDate}
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* To date */}
        <div className="flex flex-col">
          <label htmlFor="toDate" className="mb-1 font-medium">
            To date
          </label>
          <input
            id="toDate"
            type="date"
            name="toDate"
            defaultValue={toDate}
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* Lesson ID */}
        <div className="flex flex-col">
          <label htmlFor="lessonId" className="mb-1 font-medium">
            Lesson ID
          </label>
          <input
            id="lessonId"
            type="text"
            name="lessonId"
            defaultValue={lessonId}
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* Student name */}
        <div className="flex flex-col">
          <label htmlFor="studentName" className="mb-1 font-medium">
            Student name
          </label>
          <input
            id="studentName"
            type="text"
            name="studentName"
            defaultValue={studentName}
            list="studentNames"
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* Teacher name */}
        <div className="flex flex-col">
          <label htmlFor="teacherName" className="mb-1 font-medium">
            Teacher name
          </label>
          <input
            id="teacherName"
            type="text"
            name="teacherName"
            defaultValue={teacherName}
            list="teacherNames"
            className="rounded-md border px-2 py-1"
          />
        </div>

        {/* Delivery */}
        <div className="flex flex-col">
          <label htmlFor="delivery" className="mb-1 font-medium">
            Delivery
          </label>
          <select
            id="delivery"
            name="delivery"
            defaultValue={delivery}
            className="rounded-md border px-2 py-1"
          >
            <option value="">Any</option>
            {DELIVERY.map((value) => (
              <option key={value} value={value}>
                {formatDeliveryUiLabel(value)}
              </option>
            ))}
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
