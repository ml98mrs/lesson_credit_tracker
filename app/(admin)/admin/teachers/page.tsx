import Link from "next/link";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { TeacherStatus } from "@/lib/types/teachers";
import { readProfileDisplayName } from "@/lib/types/profiles";

type StatusFilter = "current" | "potential" | "all";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "potential", label: "Potential / Inactive" },
  { key: "all", label: "All" },
];

type SearchParams = {
  status?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function TeachersIndex({ searchParams }: PageProps) {
  // 🔹 Resolve searchParams (Next 16 passes a Promise)
  const sp = (searchParams ? await searchParams : {}) as SearchParams;

  const rawStatus = (sp.status ?? "current") as string;

  const selectedStatus: StatusFilter =
    rawStatus === "current" || rawStatus === "potential"
      ? rawStatus
      : rawStatus === "all"
      ? "all"
      : "current";

  const sb = getAdminSupabase();

  // 1) Load teachers INCLUDING DB status (new)
  const { data: teachers, error: tErr } = await sb
    .from("teachers")
    .select("id, profile_id, created_at, status")
    .order("created_at", { ascending: false });

  if (tErr) {
    return (
      <Section title="Teachers">
        <p className="text-sm text-red-600">
          Error loading teachers: {tErr.message}
        </p>
      </Section>
    );
  }

  if (!teachers || teachers.length === 0) {
    return (
      <Section title="Teachers">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            No teachers found. Create one to get started.
          </p>
          <Link
            href="/admin/teachers/new"
            className="text-sm rounded-lg border px-3 py-1.5 hover:bg-gray-50"
          >
            New teacher
          </Link>
        </div>
      </Section>
    );
  }

   // 2) Load teacher names from profiles
  const profileIds = teachers.map((t) => t.profile_id);
  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("id, preferred_name, full_name")
    .in("id", profileIds);

  if (pErr) {
    return (
      <Section title="Teachers">
        <p className="text-sm text-red-600">
          Error loading teacher profiles: {pErr.message}
        </p>
      </Section>
    );
  }

  const nameByProfile = new Map<
    string,
    { displayName: string; fullName: string }
  >(
    (profiles ?? []).map((p) => {
      const profileObj = {
        full_name: p.full_name as string | null,
        preferred_name: p.preferred_name as string | null,
      };

      const id = p.id as string;
      const displayName =
        readProfileDisplayName(profileObj, id.slice(0, 8) + "…") ??
        id.slice(0, 8) + "…";

      return [
        id,
        {
          displayName,
          // Full legal name can stay as the raw full_name string
          fullName: (p.full_name as string | null) ?? "",
        },
      ];
    }),
  );

  // 3) Load student-teacher links + student statuses to compute counts
  const teacherIds = teachers.map((t) => t.id);

  const { data: links, error: lErr } = await sb
    .from("student_teacher")
    .select("teacher_id, student_id")
    .in("teacher_id", teacherIds);

  if (lErr) {
    return (
      <Section title="Teachers">
        <p className="text-sm text-red-600">
          Error loading teacher/student links: {lErr.message}
        </p>
      </Section>
    );
  }

  const studentIds = Array.from(
    new Set((links ?? []).map((l) => l.student_id as string))
  );

  let statusByStudent = new Map<string, string>();

  if (studentIds.length > 0) {
    const { data: students, error: sErr } = await sb
      .from("students")
      .select("id, status")
      .in("id", studentIds);

    if (sErr) {
      return (
        <Section title="Teachers">
          <p className="text-sm text-red-600">
            Error loading student statuses: {sErr.message}
          </p>
        </Section>
      );
    }

    statusByStudent = new Map(
      (students ?? []).map((s) => [s.id as string, s.status as string])
    );
  }

  // 4) Compute counts (active/total) per teacher (status now comes from DB)
  const countsByTeacher = new Map<
    string,
    { activeCount: number; totalCount: number }
  >();

  for (const t of teachers) {
    const tid = t.id as string;
    const teacherLinks = (links ?? []).filter((l) => l.teacher_id === tid);

    const totalCount = teacherLinks.length;
    let activeCount = 0;

    for (const link of teacherLinks) {
      const sid = link.student_id as string;
      const sStatus = statusByStudent.get(sid);
      if (sStatus === "current" || sStatus === "dormant") {
        activeCount += 1;
      }
    }

    countsByTeacher.set(tid, { activeCount, totalCount });
  }

  // 5) Filter in-memory using DB status
  const filteredTeachers = teachers.filter((t) => {
    const status = (t.status as TeacherStatus) ?? "potential";

    if (selectedStatus === "all") {
      return true; // show all statuses for now, including 'past'
    }

    if (selectedStatus === "current") {
      return status === "current";
    }

    // "potential" tab shows both 'potential' and 'inactive'
    if (selectedStatus === "potential") {
      return status === "potential" || status === "inactive";
    }

    return true;
  });

  return (
    <Section title="Teachers">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.key === selectedStatus;
            const href =
              tab.key === "current"
                ? "/admin/teachers"
                : `/admin/teachers?status=${tab.key}`;

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

        <Link
          href="/admin/teachers/new"
          className="text-sm rounded-lg border px-3 py-1.5 hover:bg-gray-50"
        >
          New teacher
        </Link>
      </div>

      <ul className="divide-y rounded-xl border bg-white">
        {filteredTeachers.map((t) => {
          const tid = t.id as string;
          const nameEntry = nameByProfile.get(t.profile_id) ?? {
            displayName: tid.slice(0, 8) + "…",
            fullName: "",
          };
          const counts =
            countsByTeacher.get(tid) ?? {
              activeCount: 0,
              totalCount: 0,
            };
          const status = (t.status as TeacherStatus) ?? "potential";

          return (
            <li
              key={tid}
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
                    Status: {status}
                  </span>
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                    Students: {counts.activeCount} active /{" "}
                    {counts.totalCount} total
                  </span>
                </div>
              </div>
              <Link
                className="text-sm underline"
                href={`/admin/teachers/${tid}`}
              >
                Open
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
