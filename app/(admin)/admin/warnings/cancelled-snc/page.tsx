import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatDateTimeLondon } from "@/lib/formatters";
import { Delivery, Tier, SncMode } from "@/lib/enums";

export const dynamic = "force-dynamic";

type ProfileRel = { full_name: string } | { full_name: string }[] | null;

type StudentRel =
  | {
      tier: Tier;
      profiles?: ProfileRel;
    }
  | {
      tier: Tier;
      profiles?: ProfileRel;
    }[];

type TeacherRel =
  | {
      profiles?: ProfileRel;
    }
  | {
      profiles?: ProfileRel;
    }[];

type LessonRow = {
  id: string;
  occurred_at: string;
  duration_min: number;
  delivery: Delivery;
  snc_mode: SncMode | null;
  notes: string | null;
  students?: StudentRel | null;
  teachers?: TeacherRel | null;
};

function readName(
  rel: LessonRow["students"] | LessonRow["teachers"],
): string {
  if (!rel) return "(unknown)";

  const withProfiles = Array.isArray(rel) ? rel[0] : rel;
  const p = withProfiles?.profiles;

  if (!p) return "(unknown)";
  if (Array.isArray(p)) return p[0]?.full_name ?? "(unknown)";
  return p.full_name ?? "(unknown)";
}

function readTier(rel: LessonRow["students"]): Tier | null {
  if (!rel) return null;
  const withTier = Array.isArray(rel) ? rel[0] : rel;
  return withTier?.tier ?? null;
}

// Simple UK date formatter for the range labels
function formatDateUK(d: Date): string {
  return d.toLocaleDateString("en-GB");
}

// Expect searchParams.from / searchParams.to as YYYY-MM-DD (from <input type="date">)
function parseDateRange(searchParams?: {
  from?: string;
  to?: string;
}): { from: Date; to: Date; fromInput: string; toInput: string } {
  const now = new Date();

  // Defaults: previous calendar month in UTC (same as old behaviour)
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const lastMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  let from = lastMonthStart;
  let to = thisMonthStart;

  const rawFrom = searchParams?.from;
  const rawTo = searchParams?.to;

  if (rawFrom && rawTo) {
    const parsedFrom = new Date(`${rawFrom}T00:00:00.000Z`);
    const parsedTo = new Date(`${rawTo}T00:00:00.000Z`);

    if (
      !Number.isNaN(parsedFrom.getTime()) &&
      !Number.isNaN(parsedTo.getTime()) &&
      parsedFrom < parsedTo
    ) {
      from = parsedFrom;
      to = parsedTo;
    }
  }

  return {
    from,
    to,
    fromInput: searchParams?.from ?? from.toISOString().slice(0, 10),
    toInput: searchParams?.to ?? to.toISOString().slice(0, 10),
  };
}

export default async function FreeSncPage({
  searchParams,
}: {
  // ✅ Next 16 passes this as a Promise
  searchParams?: Promise<{ from?: string; to?: string }>;
}) {
  const sb = getAdminSupabase();

  // ✅ Unwrap the promise before using it
  const sp = (searchParams ? await searchParams : {}) as {
    from?: string;
    to?: string;
  };

  // 1) Resolve date range (defaults to previous calendar month)
  const { from, to, fromInput, toInput } = parseDateRange(sp);

  // 2) Query free SNC lessons in that range, premium/elite only
  const { data, error } = await sb
    .from("lessons")
    .select(
      `
        id,
        occurred_at,
        duration_min,
        delivery,
        snc_mode,
        notes,
        students:student_id (
          tier,
          profiles ( full_name )
        ),
        teachers:teacher_id (
          profiles ( full_name )
        )
      `,
    )
    .eq("is_snc", true)
    .eq("state", "confirmed")
    .eq("snc_mode", "free")
    .gte("occurred_at", from.toISOString())
    .lt("occurred_at", to.toISOString())
    .in("students.tier", ["premium", "elite"])
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as LessonRow[];

  return (
    <Section
      title="Free SNCs (premium / elite)"
      subtitle="Premium and elite students who used their 1× free short-notice cancellation within the selected period."
    >
      {/* Date range filter (simple GET form) */}
      <form
        method="GET"
        className="mb-4 flex flex-wrap items-end gap-3 text-xs"
      >
        <div className="flex flex-col">
          <label htmlFor="from" className="mb-1 text-gray-600">
            From
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={fromInput}
            className="rounded border px-2 py-1 text-xs"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="to" className="mb-1 text-gray-600">
            To
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={toInput}
            className="rounded border px-2 py-1 text-xs"
          />
        </div>
        <button
          type="submit"
          className="rounded border px-3 py-1 text-xs font-medium hover:bg-gray-50"
        >
          Apply
        </button>
        <div className="ml-2 text-[11px] text-gray-500">
          Showing free SNCs between {formatDateUK(from)} and{" "}
          {formatDateUK(new Date(to.getTime() - 1))} (UTC, end exclusive).
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          No free SNCs for premium/elite students in this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Lesson ID</th>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Tier</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Delivery</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-4">
                    {formatDateTimeLondon(r.occurred_at)}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.id}</td>
                  <td className="py-2 pr-4">{readName(r.students)}</td>
                  <td className="py-2 pr-4">
                    {readTier(r.students) ?? "—"}
                  </td>
                  <td className="py-2 pr-4">{readName(r.teachers)}</td>
                  <td className="py-2 pr-4">
                    {r.delivery === "f2f" ? "F2F" : "Online"}
                  </td>
                  <td className="py-2 pr-4">{r.duration_min} min</td>
                  <td className="py-2 pr-4">{r.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
