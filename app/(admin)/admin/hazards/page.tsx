// app/(admin)/admin/hazards/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { lessonHazardsBaseQuery } from "@/lib/api/admin/lessons";
import ResolveHazardButton from "./ResolveHazardButton";

// Basic hazard type for this page
type Hazard = {
  lesson_id: string;
  allocation_id: string | null;
  hazard_type: string;
  severity: string;
};

// Presentation-only label mapping
function formatHazardType(hazardType: string): string {
  switch (hazardType) {
    case "length_too_short":
      return "Lesson length too short";
    case "length_restriction_mismatch":
      return "Lesson shorter than lot’s required length";
    case "delivery_f2f_on_online":
      return "F2F lesson allocated to online-only credit";
    case "delivery_online_on_f2f":
      return "Online lesson allocated to F2F-only credit";
    case "overdraft_used":
      return "Lesson confirmed using overdraft credit";
    default:
      return hazardType;
  }
}

function formatSeverity(severity: string): string {
  switch (severity) {
    case "red":
      return "Red";
    case "amber":
      return "Amber";
    case "yellow":
      return "Yellow";
    default:
      return severity || "Unknown";
  }
}

export default async function HazardsPage() {
  const sb = getAdminSupabase();

  const { data, error } = await lessonHazardsBaseQuery(sb)
    .order("severity", { ascending: false }) // simple lexical ordering
    .order("lesson_id", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Hazard[];

  return (
    <Section
      title="Active hazards"
      subtitle="Unresolved lesson and allocation hazards from v_lesson_hazards."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No active hazards 🎉</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Lesson ID</th>
                <th className="py-2 pr-4">Allocation ID</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Severity</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Resolve</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={`${r.lesson_id}-${r.allocation_id ?? "none"}-${idx}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="py-2 pr-4 font-mono text-xs">
                    {r.lesson_id}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {r.allocation_id ?? "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {formatHazardType(r.hazard_type)}
                  </td>
                  <td className="py-2 pr-4">
                    {formatSeverity(r.severity)}
                  </td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/lessons/review?lessonId=${encodeURIComponent(
                        r.lesson_id,
                      )}`}
                      className="text-blue-700 underline"
                    >
                      Review lesson
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <ResolveHazardButton
                      hazardType={r.hazard_type}
                      lessonId={r.lesson_id}
                      allocationId={r.allocation_id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500">
        Data source: <code>v_lesson_hazards</code>. Use the Review link to
        resolve hazards via the normal lesson flow.
      </p>
    </Section>
  );
}
