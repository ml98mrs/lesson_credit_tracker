// lib/api/admin/dashboard.ts
//
// Read-only helpers for the Admin Dashboard.
// IMPORTANT: No allocation/SNC/expiry/write-off logic here.
// Just simple counts/aggregates that rely on existing DB rules.

import { getAdminSupabase } from "@/lib/supabase/admin";

export async function getPendingLessonsCount(): Promise<number> {
  const supabase = getAdminSupabase(); // same as queue page

  const { count, error } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("state", "pending"); // 👈 mirror queue: .eq("state", "pending")

  if (error) {
    console.error("Error fetching pending lessons count", error);
    // For the dashboard, fail soft and show 0.
    return 0;
  }

  return count ?? 0;
}

/**
 * Total remaining minutes across all non-expired, open credit lots.
 * - Uses v_credit_lot_remaining to respect existing allocation/expiry rules.
 * - Includes negative minutes (overdrawn lots) so this is a NET total.
 */
export async function getTotalRemainingMinutes(): Promise<number> {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("v_credit_lot_remaining")
    .select("minutes_remaining, days_to_expiry, expiry_date, state")
    // Only open lots
    .eq("state", "open")
    // Non-expired: either no expiry date, or days_to_expiry >= 0
    .or("expiry_date.is.null,days_to_expiry.gte.0");

  if (error) {
    console.error("Error fetching total remaining minutes", error);
    return 0;
  }

  const total =
    data?.reduce(
      (sum, row) => sum + (row.minutes_remaining ?? 0),
      0,
    ) ?? 0;

  return total;
}

export type StudentLifecycleSummary = {
  current: number;
  dormant: number;
  past: number;
};

/**
 * Count students by lifecycle status.
 * Relies on student_status enum on students.status: current | dormant | past.
 */
export async function getStudentLifecycleSummary(): Promise<StudentLifecycleSummary> {
  const supabase = getAdminSupabase();

  const [currentRes, dormantRes, pastRes] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("status", "current"),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("status", "dormant"),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("status", "past"),
  ]);

  const safeCount = (res: typeof currentRes) => {
    if (res.error) {
      console.error("Error fetching student lifecycle count", res.error);
      return 0;
    }
    return res.count ?? 0;
  };

  return {
    current: safeCount(currentRes),
    dormant: safeCount(dormantRes),
    past: safeCount(pastRes),
  };
}
// lib/api/admin/dashboard.ts

export type ExpiringSoonBucket = {
  studentCount: number;
  totalMinutes: number;
};

export type ExpiringSoonSummary = {
  mandatory: ExpiringSoonBucket;
  advisory: ExpiringSoonBucket;
};

/**
 * Credit expiring in the next 30 days, split by expiry_policy.
 * - Uses v_credit_lot_remaining.expiry_within_30d (DB owns the rule).
 * - Only open lots with positive minutes_remaining.
 * - studentCount = distinct students per policy.
 * - totalMinutes = sum of minutes_remaining per policy.
 */
export async function getExpiringSoonSummary(): Promise<ExpiringSoonSummary> {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("v_credit_lot_remaining")
    .select("student_id, minutes_remaining, expiry_policy, expiry_within_30d, state")
    .eq("expiry_within_30d", true)
    .eq("state", "open")
    .gt("minutes_remaining", 0)
    .in("expiry_policy", ["mandatory", "advisory"]);

  if (error) {
    console.error("Error fetching expiring soon summary", error);
    return {
      mandatory: { studentCount: 0, totalMinutes: 0 },
      advisory: { studentCount: 0, totalMinutes: 0 },
    };
  }

  const mandatoryStudents = new Set<string>();
  const advisoryStudents = new Set<string>();

  let mandatoryMinutes = 0;
  let advisoryMinutes = 0;

  for (const row of data ?? []) {
    const minutes = row.minutes_remaining ?? 0;
    const policy = row.expiry_policy as "mandatory" | "advisory" | null;

    if (!policy) continue;

    if (policy === "mandatory") {
      mandatoryMinutes += minutes;
      if (row.student_id) mandatoryStudents.add(row.student_id);
    } else if (policy === "advisory") {
      advisoryMinutes += minutes;
      if (row.student_id) advisoryStudents.add(row.student_id);
    }
  }

  return {
    mandatory: {
      studentCount: mandatoryStudents.size,
      totalMinutes: mandatoryMinutes,
    },
    advisory: {
      studentCount: advisoryStudents.size,
      totalMinutes: advisoryMinutes,
    },
  };
}

/**
 * Count of students on premium/elite who used a FREE SNC
 * in the *previous* calendar month.
 *
 * - Uses lessons.snc_mode = 'free' (DB owns SNC rules)
 * - Only confirmed SNC lessons
 * - Previous month = full calendar month before the current one (UTC).
 */
export async function getLastMonthFreeSncPremiumEliteCount(): Promise<number> {
  const supabase = getAdminSupabase();

  // Compute previous month boundaries in UTC
  const now = new Date();
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const lastMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  // 1) Get students with a FREE SNC last month
  const { data: sncRows, error: sncError } = await supabase
    .from("lessons")
    .select("student_id") // 👈 removed { distinct: true }
    .eq("is_snc", true)
    .eq("state", "confirmed")
    .eq("snc_mode", "free")
    .gte("occurred_at", lastMonthStart.toISOString())
    .lt("occurred_at", thisMonthStart.toISOString());

  if (sncError) {
    console.error("Error fetching free SNC students last month", sncError);
    return 0;
  }

  // Deduplicate in JS just in case
  const studentIds = Array.from(
    new Set(
      (sncRows ?? [])
        .map((row: { student_id: string | null }) => row.student_id)
        .filter((id): id is string => !!id),
    ),
  );

  if (studentIds.length === 0) {
    return 0;
  }

  // 2) Among those, count how many are premium/elite
  const { count, error: tierError } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .in("id", studentIds)
    .in("tier", ["premium", "elite"]);

  if (tierError) {
    console.error("Error fetching premium/elite SNC students last month", tierError);
    return 0;
  }

  return count ?? 0;
}
export type TeacherLifecycleSummary = {
  current: number;
  potential: number;
};

export async function getTeacherLifecycleSummary(): Promise<TeacherLifecycleSummary> {
  const sb = getAdminSupabase();

  // 1) All teachers
  const { data: teachers, error: tErr } = await sb
    .from("teachers")
    .select("id");

  if (tErr || !teachers || teachers.length === 0) {
    if (tErr) {
      console.error("Error fetching teachers for lifecycle summary", tErr);
    }
    return { current: 0, potential: 0 };
  }

  const teacherIds = teachers.map((t) => t.id as string);

  // 2) All student/teacher links for those teachers
  const { data: links, error: lErr } = await sb
    .from("student_teacher")
    .select("teacher_id, student_id")
    .in("teacher_id", teacherIds);

  if (lErr) {
    console.error(
      "Error fetching teacher/student links for lifecycle summary",
      lErr,
    );
    // If links fail, treat everyone as potential
    return { current: 0, potential: teacherIds.length };
  }

  const studentIds = Array.from(
    new Set((links ?? []).map((l) => l.student_id as string)),
  );

  // 3) Status of linked students
  let statusByStudent = new Map<string, string>();

  if (studentIds.length > 0) {
    const { data: students, error: sErr } = await sb
      .from("students")
      .select("id, status")
      .in("id", studentIds);

    if (sErr) {
      console.error(
        "Error fetching student statuses for lifecycle summary",
        sErr,
      );
    } else {
      statusByStudent = new Map(
        (students ?? []).map((s) => [s.id as string, s.status as string]),
      );
    }
  }

  // 4) Derive teacher status: current if any current/dormant student, else potential
  let current = 0;
  let potential = 0;

  for (const t of teachers) {
    const tid = t.id as string;
    const teacherLinks = (links ?? []).filter((l) => l.teacher_id === tid);

    let hasActiveStudent = false;

    for (const link of teacherLinks) {
      const sid = link.student_id as string;
      const sStatus = statusByStudent.get(sid);
      if (sStatus === "current" || sStatus === "dormant") {
        hasActiveStudent = true;
        break;
      }
    }

    if (hasActiveStudent) {
      current += 1;
    } else {
      potential += 1;
    }
  }

  return { current, potential };
}