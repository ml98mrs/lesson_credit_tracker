// app/(student)/student/lessons/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatDateTimeLondon } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type Delivery = "online" | "f2f" | "hybrid";

type LessonRow = {
  lesson_id: string;
  occurred_at: string;
  duration_min: number;
  delivery: Delivery;
  is_snc: boolean;
  snc_mode: "free" | "charged" | "none" | string;
  state: string;
  teacher_full_name: string;
};

type SearchParams = {
  from?: string;
  to?: string;
  teacher?: string;
  delivery?: string;
  minDuration?: string;
  maxDuration?: string;
  snc?: string;
};

const formatDelivery = (d: Delivery) => {
  switch (d) {
    case "online":
      return "Online";
    case "f2f":
      return "Face to face";
    case "hybrid":
      return "Hybrid";
    default:
      return d;
  }
};

const renderSncBadge = (lesson: LessonRow) => {
  if (!lesson.is_snc) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  if (lesson.snc_mode === "free") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Free SNC (no credit used)
      </span>
    );
  }

  if (lesson.snc_mode === "charged") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Charged SNC (minutes deducted)
      </span>
    );
  }

  // Fallback for any historical/edge cases
  return (
    <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
      SNC
    </span>
  );
};

export default async function StudentLessons({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // 🔹 resolve search params (Next 16 passes a Promise)
  const sp = await searchParams;

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
      <Section title="Lessons" subtitle="Confirmed lessons for your account.">
        <p className="text-sm text-gray-600">
          No student record is linked to this account yet. Please contact the
          administrator.
        </p>
      </Section>
    );
  }

  const studentId = studentRow.id as string;

  // 3) Normalise filters from searchParams
  const dateFrom = sp.from || undefined;
  const dateTo = sp.to || undefined;
  const teacherFilter = sp.teacher || undefined;
  const deliveryFilter = sp.delivery as Delivery | undefined;
  const minDuration = sp.minDuration ? Number(sp.minDuration) : undefined;
  const maxDuration = sp.maxDuration ? Number(sp.maxDuration) : undefined;
  const sncFilter = sp.snc || undefined;

  // 4) Build filtered query
  let query = supabase
    .from("v_student_lessons")
    .select(
      "lesson_id,occurred_at,duration_min,delivery,is_snc,snc_mode,state,teacher_full_name",
    )
    .eq("student_id", studentId)
    .eq("state", "confirmed");

  // Date range (inclusive)
  if (dateFrom) {
    // occurred_at >= from (treated as start of that day in UTC)
    query = query.gte("occurred_at", dateFrom);
  }
  if (dateTo) {
    // inclusive "to": occurred_at < next day
    const to = new Date(dateTo);
    to.setDate(to.getDate() + 1);
    query = query.lt("occurred_at", to.toISOString());
  }

  if (teacherFilter) {
    query = query.ilike("teacher_full_name", `%${teacherFilter}%`);
  }

  if (deliveryFilter) {
    query = query.eq("delivery", deliveryFilter);
  }

  if (minDuration != null && !Number.isNaN(minDuration)) {
    query = query.gte("duration_min", minDuration);
  }

  if (maxDuration != null && !Number.isNaN(maxDuration)) {
    query = query.lte("duration_min", maxDuration);
  }

  if (sncFilter === "snc") {
    query = query.eq("is_snc", true);
  } else if (sncFilter === "free") {
    query = query.eq("snc_mode", "free");
  } else if (sncFilter === "charged") {
    query = query.eq("snc_mode", "charged");
  } else if (sncFilter === "none") {
    query = query.eq("is_snc", false);
  }
  // sncFilter === "" or undefined → no extra filter

  query = query.order("occurred_at", { ascending: false });

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const lessons = (data ?? []) as unknown as LessonRow[];

  return (
    <Section title="Lessons" subtitle="Confirmed lessons for your account.">
      {/* Filters */}
      <form
        className="mb-4 grid gap-3 text-xs md:grid-cols-4 lg:grid-cols-6"
        method="GET"
      >
        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-gray-600">
            From (date)
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={dateFrom}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-gray-600">
            To (date)
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={dateTo}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* Teacher */}
        <div className="flex flex-col gap-1">
          <label htmlFor="teacher" className="text-gray-600">
            Teacher
          </label>
          <input
            id="teacher"
            name="teacher"
            type="text"
            placeholder="Name contains…"
            defaultValue={teacherFilter}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* Delivery */}
        <div className="flex flex-col gap-1">
          <label htmlFor="delivery" className="text-gray-600">
            Delivery
          </label>
          <select
            id="delivery"
            name="delivery"
            defaultValue={deliveryFilter ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="f2f">Face to face</option>
          </select>
        </div>

        {/* Duration min */}
        <div className="flex flex-col gap-1">
          <label htmlFor="minDuration" className="text-gray-600">
            Min duration (min)
          </label>
          <input
            id="minDuration"
            name="minDuration"
            type="number"
            min={0}
            defaultValue={sp.minDuration}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* Duration max */}
        <div className="flex flex-col gap-1">
          <label htmlFor="maxDuration" className="text-gray-600">
            Max duration (min)
          </label>
          <input
            id="maxDuration"
            name="maxDuration"
            type="number"
            min={0}
            defaultValue={sp.maxDuration}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* SNC filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="snc" className="text-gray-600">
            SNC
          </label>
          <select
            id="snc"
            name="snc"
            defaultValue={sncFilter ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="snc">SNC only</option>
            <option value="free">Free SNC only</option>
            <option value="charged">Charged SNC only</option>
            <option value="none">Non-SNC lessons</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded border bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
          >
            Apply filters
          </button>
          <Link
            href="/student/lessons"
            className="rounded border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Results */}
      {lessons.length === 0 ? (
        <p className="text-sm text-gray-600">
          No lessons match your current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Delivery</th>
                <th className="py-2 pr-4">Duration (min)</th>
                <th className="py-2 pr-4">SNC</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.lesson_id} className="border-b">
                  <td className="py-2 pr-4">
                    {formatDateTimeLondon(lesson.occurred_at)}
                  </td>
                  <td className="py-2 pr-4">{lesson.teacher_full_name}</td>
                  <td className="py-2 pr-4">
                    {formatDelivery(lesson.delivery)}
                  </td>
                  <td className="py-2 pr-4">{lesson.duration_min}</td>
                  <td className="py-2 pr-4">{renderSncBadge(lesson)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
