// app/(admin)/admin/write-offs/page.tsx
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  formatMinutesAsHours,
  formatDateTimeLondon,
} from "@/lib/formatters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  period?: string;
};

// Supabase nested join shape, based on the error:
// students: { id: any; profiles: { full_name: any }[] }[]
type ProfileRel = {
  full_name: string | null;
};

type StudentRel = {
  id: string;
  profiles: ProfileRel[];
};

type WriteOffQueryRow = {
  id: string;
  student_id: string;
  direction: "positive" | "negative";
  minutes: number;
  reason_code: string;
  note: string | null;
  accounting_period: string;
  created_at: string;
  students: StudentRel[]; // array of students with profiles[]
};

type WriteOffRow = {
  id: string;
  studentId: string;
  studentName: string;
  direction: "positive" | "negative";
  minutes: number;
  reasonCode: string;
  note: string;
  accountingPeriod: string;
  createdAt: string;
};

export default async function WriteOffsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const period = searchParams?.period ?? null;
  const sb = getAdminSupabase();

  // Base query
  let query = sb
    .from("credit_write_offs")
    .select(
      `
        id,
        student_id,
        direction,
        minutes,
        reason_code,
        note,
        accounting_period,
        created_at,
        students (
          id,
          profiles (
            full_name
          )
        )
      `,
    )
    .order("created_at", { ascending: false });

  if (period) {
    query = query.eq("accounting_period", period);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Now TS sees the shapes as compatible: students: { id; profiles[] }[]
  const rawRows = (data ?? []) as WriteOffQueryRow[];

  const rows: WriteOffRow[] = rawRows.map((row) => {
    let studentName = "(student)";

    const students = row.students;
    if (Array.isArray(students) && students.length > 0) {
      const profiles = students[0]?.profiles;
      if (Array.isArray(profiles) && profiles.length > 0) {
        studentName = profiles[0]?.full_name ?? "(student)";
      }
    }

    return {
      id: row.id,
      studentId: row.student_id,
      studentName,
      direction: row.direction,
      minutes: row.minutes,
      reasonCode: row.reason_code,
      note: row.note ?? "",
      accountingPeriod: row.accounting_period,
      createdAt: row.created_at,
    };
  });

  return (
    <Section
      title="Credit write-offs"
      subtitle="Ledger of credit write-offs for accounting. Hours are shown to two decimal places."
    >
      {/* Simple filter by accounting period (GET ?period=...) */}
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Accounting period:</span>
          <input
            name="period"
            defaultValue={period ?? ""}
            placeholder="e.g. 2025 or 2024-2025"
            className="rounded-md border px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
        >
          Filter
        </button>
        {period && (
          <a
            href="/admin/write-offs"
            className="text-xs text-gray-500 underline"
          >
            Clear
          </a>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          No credit write-offs found
          {period ? ` for period “${period}”` : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Direction</th>
                <th className="py-2 pr-4">Hours</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Accounting period</th>
                <th className="py-2 pr-4">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2 pr-4">
                    {formatDateTimeLondon(r.createdAt)}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="font-medium">{r.studentName}</div>
                    <div className="text-[10px] text-gray-500">
                      {r.studentId}
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    {r.direction === "positive"
                      ? "Positive (unused credit)"
                      : "Negative (overdraft/debt)"}
                  </td>
                  <td className="py-2 pr-4">
                    {formatMinutesAsHours(r.minutes)} h
                  </td>
                  <td className="py-2 pr-4 text-xs">{r.reasonCode}</td>
                  <td className="py-2 pr-4 text-xs">
                    {r.accountingPeriod}
                  </td>
                  <td className="py-2 pr-4 text-xs whitespace-pre-wrap">
                    {r.note || "—"}
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
