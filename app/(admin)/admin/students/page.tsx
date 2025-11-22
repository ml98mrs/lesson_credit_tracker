import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";

type StatusKey = "current" | "dormant" | "past" | "all";

const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "dormant", label: "Dormant" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function StudentsPage({ searchParams }: PageProps) {
  // unwrap Next's promise-style searchParams
  const { status } = await searchParams;
  const rawStatus = (status ?? "current") as string;

  const selectedStatus: StatusKey =
    rawStatus === "current" || rawStatus === "dormant" || rawStatus === "past"
      ? rawStatus
      : rawStatus === "all"
      ? "all"
      : "current";

  const sb = getAdminSupabase();

  // ---- Fetch students (optionally filtered by status) ----
  let studentsQuery = sb
    .from("students")
    .select("id, profile_id, status, tier, created_at")
    .order("created_at", { ascending: false });

  if (selectedStatus !== "all") {
    studentsQuery = studentsQuery.eq("status", selectedStatus);
  }

  const { data: studentsData, error: sErr } = await studentsQuery;

  if (sErr) {
    return (
      <p className="text-sm text-red-600">
        Error loading students: {sErr.message}
      </p>
    );
  }

  const students = studentsData ?? [];

  // ---- Fetch names from profiles (only if we have students) ----
  let nameByProfile = new Map<
    string,
    { displayName: string; fullName: string }
  >();

  if (students.length > 0) {
    const profileIds = students.map((s) => s.profile_id);
    const { data: profiles, error: pErr } = await sb
      .from("profiles")
      .select("id, preferred_name, full_name")
      .in("id", profileIds);

    if (pErr) {
      return (
        <p className="text-sm text-red-600">
          Error loading profiles: {pErr.message}
        </p>
      );
    }

    nameByProfile = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          displayName:
            (p.preferred_name as string | null) ||
            (p.full_name as string) ||
            "—",
          fullName: (p.full_name as string) || "",
        },
      ]),
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row: title + New student button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Students</h1>
        <Link
          href="/admin/students/new"
          className="text-sm rounded-lg border px-3 py-1.5 hover:bg-gray-50"
        >
          New student
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 text-sm">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.key === selectedStatus;
          const href =
            tab.key === "current"
              ? "/admin/students"
              : `/admin/students?status=${tab.key}`;

          return (
            <Link
              key={tab.key}
              href={href}
              className={[
                "rounded-full border px-3 py-1",
                isActive
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Students list / empty state */}
      {students.length === 0 ? (
        <p className="text-sm text-gray-600">
          No students found for this status.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-white">
          {students.map((s) => {
            const nameEntry = nameByProfile.get(s.profile_id) ?? {
              displayName: s.id.slice(0, 8) + "…",
              fullName: "",
            };

            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="space-y-0.5">
                  <div className="font-medium">{nameEntry.displayName}</div>
                  {nameEntry.fullName &&
                    nameEntry.fullName !== nameEntry.displayName && (
                      <div className="text-xs text-gray-500">
                        Legal name: {nameEntry.fullName}
                      </div>
                    )}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                      Status: {s.status}
                    </span>
                    {s.tier && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                        Tier: {s.tier}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  className="text-sm underline"
                  href={`/admin/students/${s.id}`}
                >
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
