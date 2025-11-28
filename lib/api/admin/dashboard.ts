// lib/api/admin/dashboard.ts
//
// Read-only helpers for the Admin Dashboard.
// IMPORTANT: No allocation/SNC/expiry/write-off logic here.
// Just simple counts/aggregates that rely on existing DB rules.

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminClient, logAdminError } from "./_shared";
import type { TeacherStatus, ExpiryPolicy } from "@/lib/enums";
import {
  readProfileDisplayName,
  type ProfilesDisplayEmbed,
} from "@/lib/types/profiles";
import type { VCreditLotRemainingRow } from "@/lib/types/views/credit";

// Reuse the canonical pending-lessons implementation from lessons.ts
export { getPendingLessonsCount } from "./lessons";


// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type StudentLifecycleSummary = {
  current: number;
  dormant: number;
  past: number;
};

export type TeacherLifecycleSummary = {
  current: number;
  inactive: number;
  potential: number;
  past: number;
};

export type ExpiringSoonBucket = {
  studentCount: number;
  totalMinutes: number;
};

export type ExpiringSoonSummary = {
  mandatory: ExpiringSoonBucket;
  advisory: ExpiringSoonBucket;
};

export type LifecycleNotification = {
  id: string;
  variant: "info" | "warning" | "success";
  title: string;
  body?: string;
  createdAt: string; // ISO timestamp
};

// ────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────

/**
 * Previous calendar month bounds in UTC.
 * Example: if now is 2025-11-25, this returns:
 *  - lastMonthStart: 2025-10-01T00:00:00Z
 *  - thisMonthStart: 2025-11-01T00:00:00Z
 */
function getPreviousMonthBoundsUtc(): {
  lastMonthStart: Date;
  thisMonthStart: Date;
} {
  const now = new Date();
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const lastMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return { lastMonthStart, thisMonthStart };
}



// ────────────────────────────────────────────────────────────────
// Total remaining minutes
// ────────────────────────────────────────────────────────────────

/**
 * Total remaining minutes across all non-expired, open credit lots.
 * - Uses v_credit_lot_remaining to respect existing allocation/expiry rules.
 * - Includes negative minutes (overdrawn lots) so this is a NET total.
 */
export async function getTotalRemainingMinutes(): Promise<number> {
  const sb = getAdminClient();

  const { data, error } = await sb
    .from("v_credit_lot_remaining")
    .select("minutes_remaining, state, expiry_date, days_to_expiry")
    // Only open lots
    .eq("state", "open")
    // Non-expired: either no expiry date, or days_to_expiry >= 0
    .or("expiry_date.is.null,days_to_expiry.gte.0");

  if (error) {
    logAdminError("Error fetching total remaining minutes", error);
    return 0;
  }

  // Cast via unknown to avoid GenericStringError[] union complaints
  const rows =
    (data ?? []) as unknown as VCreditLotRemainingRow[];

  const total = rows.reduce(
    (sum, row) => sum + (row.minutes_remaining ?? 0),
    0,
  );

  return total;
}


// ────────────────────────────────────────────────────────────────
// Lifecycle summaries
// ────────────────────────────────────────────────────────────────

/**
 * Count students by lifecycle status.
 * Relies on student_status enum on students.status: current | dormant | past.
 *
 * Uses v_student_lifecycle_summary to keep the aggregation in SQL.
 */
export async function getStudentLifecycleSummary(): Promise<StudentLifecycleSummary> {
  const sb = getAdminSupabase();

  const { data, error } = await sb
    .from("v_student_lifecycle_summary")
    .select("current, dormant, past")
    .single();

  if (error || !data) {
    if (error) {
      console.error("Error fetching student lifecycle summary", error);
    }
    return {
      current: 0,
      dormant: 0,
      past: 0,
    };
  }

  return {
    current: data.current ?? 0,
    dormant: data.dormant ?? 0,
    past: data.past ?? 0,
  };
}

/**
 * Count teachers by lifecycle status.
 * Relies on teacher_status enum on teachers.status: current | inactive | potential | past.
 *
 * Calls rpc_refresh_teacher_statuses() first so teachers.status is aligned with
 * linked students, then aggregates.
 */
export async function getTeacherLifecycleSummary(): Promise<TeacherLifecycleSummary> {
  const sb = getAdminSupabase();

  const summary: TeacherLifecycleSummary = {
    current: 0,
    inactive: 0,
    potential: 0,
    past: 0,
  };

  // 1) Ensure teacher.status is up to date with student statuses
  const { error: rpcErr } = await sb.rpc("rpc_refresh_teacher_statuses");
  if (rpcErr) {
    console.error(
      "Error refreshing teacher statuses in getTeacherLifecycleSummary",
      rpcErr,
    );
    // Fall through and just count whatever is currently in teachers.status
  }

  // 2) Count teachers by status
  const { data: teachers, error: tErr } = await sb
    .from("teachers")
    .select("status");

  if (tErr || !teachers) {
    if (tErr) {
      console.error(
        "Error fetching teachers for lifecycle summary",
        tErr,
      );
    }
    return summary;
  }

  for (const row of teachers) {
    const status = row.status as TeacherStatus | null;

    if (!status) {
      // Shouldn’t happen because of NOT NULL + default, but be defensive
      summary.potential += 1;
      continue;
    }

    switch (status) {
      case "current":
      case "inactive":
      case "potential":
      case "past":
        summary[status] += 1;
        break;
      default: {
        // Unknown status → bucket into potential and keep type exhaustive
        const _exhaustive: never = status;
        summary.potential += 1;
        break;
      }
    }
  }

  return summary;
}

// ────────────────────────────────────────────────────────────────
// Expiring credit
// ────────────────────────────────────────────────────────────────

/**
 * Credit expiring in the next 30 days, split by expiry_policy.
 * - Uses v_credit_lot_remaining.expiry_within_30d (DB owns the rule).
 * - Only open lots with positive minutes_remaining.
 * - studentCount = distinct students per policy.
 * - totalMinutes = sum of minutes_remaining per policy.
 */
export async function getExpiringSoonSummary(): Promise<ExpiringSoonSummary> {
  const sb = getAdminClient();

  const { data, error } = await sb
    .from("v_credit_lot_remaining")
    .select(
      "student_id, minutes_remaining, expiry_policy, expiry_within_30d, state",
    )
    .eq("expiry_within_30d", true)
    .eq("state", "open")
    .gt("minutes_remaining", 0)
    .in("expiry_policy", ["mandatory", "advisory"]);

  if (error) {
    logAdminError("Error fetching expiring soon summary", error);
    return {
      mandatory: { studentCount: 0, totalMinutes: 0 },
      advisory: { studentCount: 0, totalMinutes: 0 },
    };
  }

  // TS: data can be a union internally, so cast via unknown
  const rows =
    (data ?? []) as unknown as VCreditLotRemainingRow[];

  type PolicyKey = Extract<ExpiryPolicy, "mandatory" | "advisory">;

  const studentSets: Record<PolicyKey, Set<string>> = {
    mandatory: new Set<string>(),
    advisory: new Set<string>(),
  };

  const minutesByPolicy: Record<PolicyKey, number> = {
    mandatory: 0,
    advisory: 0,
  };

  for (const row of rows) {
    const policy = row.expiry_policy as ExpiryPolicy | null;
    if (policy !== "mandatory" && policy !== "advisory") continue;

    const minutes = row.minutes_remaining ?? 0;
    minutesByPolicy[policy] += minutes;

    if (row.student_id) {
      studentSets[policy].add(row.student_id);
    }
  }

  return {
    mandatory: {
      studentCount: studentSets.mandatory.size,
      totalMinutes: minutesByPolicy.mandatory,
    },
    advisory: {
      studentCount: studentSets.advisory.size,
      totalMinutes: minutesByPolicy.advisory,
    },
  };
}


// ────────────────────────────────────────────────────────────────
// SNC / tiers – free SNCs last month
// ────────────────────────────────────────────────────────────────

/**
 * Count of students on premium/elite who used a FREE SNC
 * in the *previous* calendar month.
 *
 * - Uses lessons.snc_mode = 'free' (DB owns SNC rules)
 * - Only confirmed SNC lessons
 * - Previous month = full calendar month before the current one (UTC).
 */
export async function getLastMonthFreeSncPremiumEliteCount(): Promise<number> {
  const sb = getAdminSupabase();

  const { lastMonthStart, thisMonthStart } = getPreviousMonthBoundsUtc();

  // 1) Get students with a FREE SNC last month
  const { data: sncRows, error: sncError } = await sb
    .from("lessons")
    .select("student_id") // no distinct here; dedupe in JS
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
  const { count, error: tierError } = await sb
    .from("students")
    .select("id", { count: "exact", head: true })
    .in("id", studentIds)
    .in("tier", ["premium", "elite"]);

  if (tierError) {
    console.error(
      "Error fetching premium/elite SNC students last month",
      tierError,
    );
    return 0;
  }

  return count ?? 0;
}


export type MonthlySncSummary = {
  total: number;
  free: number;
  charged: number;
};



/**
 * SNC summary for the previous calendar month (Europe/London).
 *
 * Reuses v_student_snc_status_previous_month so that:
 * - Month boundaries (Europe/London) are owned by SQL.
 * - SNC rules (is_snc, snc_mode, confirmed-only) are owned by SQL.
 *
 * We only aggregate per-student counts into global totals.
 */
export async function getLastMonthSncSummary(): Promise<MonthlySncSummary> {
  const sb = getAdminSupabase();

  const { data, error } = await sb
    .from("v_student_snc_status_previous_month")
    .select("free_sncs, charged_sncs");

  if (error || !data) {
    if (error) {
      console.error(
        "Error fetching last-month SNC summary",
        error,
      );
    }
    return { total: 0, free: 0, charged: 0 };
  }

  let free = 0;
  let charged = 0;

  for (const row of data as {
    free_sncs: number | null;
    charged_sncs: number | null;
  }[]) {
    free += row.free_sncs ?? 0;
    charged += row.charged_sncs ?? 0;
  }

  return {
    total: free + charged,
    free,
    charged,
  };
}


// ────────────────────────────────────────────────────────────────
// Lifecycle notifications for the dashboard
// ────────────────────────────────────────────────────────────────
//
// Driven by:
//   - teacher_status_events (append-only audit of teacher status changes)
//   - student_status_events (append-only audit of student status changes)
//
// We only surface:
//   1) Teacher current -> potential
//   2) Teacher current -> inactive
//   3) Teacher inactive -> potential
//   4) Student current -> dormant
//
// All events must have is_auto = true (manual changes are handled explicitly).
// ────────────────────────────────────────────────────────────────

export async function getLifecycleNotifications(): Promise<
  LifecycleNotification[]
> {
  const sb = getAdminSupabase();
  const notifications: LifecycleNotification[] = [];

  // Show last 7 days of lifecycle events
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  // Fetch teacher + student events in parallel
  const [teacherEventsRes, studentEventsRes] = await Promise.all([
    sb
      .from("teacher_status_events")
      .select(
        "id, teacher_id, old_status, new_status, created_at, is_auto",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(50),
    sb
      .from("student_status_events")
      .select(
        "id, student_id, old_status, new_status, created_at, is_auto",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const { data: teacherEvents, error: tErr } = teacherEventsRes;
  const { data: studentEvents, error: sErr } = studentEventsRes;

  if (tErr) {
    console.error("teacher_status_events error", tErr);
  }

  if (sErr) {
    console.error("student_status_events error", sErr);
  }

  // ────────────────────────────────────────────────────────────
  // 1) Teacher status events
  // ────────────────────────────────────────────────────────────

  if (teacherEvents && teacherEvents.length > 0) {
    const teacherIds = Array.from(
      new Set(
        teacherEvents.map((e) => e.teacher_id as string),
      ),
    );

    const nameByTeacher = new Map<string, string>();

    if (teacherIds.length > 0) {
      type TeacherWithProfile = {
        id: string;
        profiles: ProfilesDisplayEmbed;
      };

      const { data: teacherRows, error: teachersErr } = await sb
        .from("teachers")
        .select("id, profiles(full_name, preferred_name)")
        .in("id", teacherIds);

      if (teachersErr) {
        console.error(
          "teachers for lifecycle events error",
          teachersErr,
        );
      }

      for (const t of (teacherRows ?? []) as TeacherWithProfile[]) {
        const tid = t.id;
        const name =
          readProfileDisplayName(
            t.profiles,
            tid.slice(0, 8) + "…",
          ) ?? tid.slice(0, 8) + "…";
        nameByTeacher.set(tid, name);
      }
    }

    for (const ev of teacherEvents) {
      if (!ev.is_auto) continue;

      const oldStatus = ev.old_status as string;
      const newStatus = ev.new_status as string;
      const key = `${oldStatus}->${newStatus}`;
      const teacherName =
        nameByTeacher.get(ev.teacher_id as string) ?? "This teacher";

      let title: string | null = null;
      let body: string | undefined;
      let variant: "info" | "warning" | "success" = "info";

      // 1) current → potential
      if (key === "current->potential") {
        title = `Teacher ${teacherName} was auto-switched from current to potential`;
        body =
          "Consider following up with this teacher about future availability (outside this app).";
        variant = "info";
      }

      // 2) current → inactive
      if (key === "current->inactive") {
        title = `Teacher ${teacherName} now has only dormant students`;
        body =
          "Review this teacher's student list. You may want to re-engage students or mark the teacher as past.";
        variant = "warning";
      }

      // 3) inactive → potential
      if (key === "inactive->potential") {
        title = `Teacher ${teacherName} now has no current or dormant students`;
        body =
          "Consider whether to keep them as potential or mark the teacher as past.";
        variant = "info";
      }

      if (title) {
        notifications.push({
          id: `teacher-${ev.id}`,
          variant,
          title,
          body,
          createdAt: ev.created_at as string,
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 2) Student status events – current → dormant
  // ────────────────────────────────────────────────────────────

  if (studentEvents && studentEvents.length > 0) {
    const studentIds = Array.from(
      new Set(
        studentEvents.map((e) => e.student_id as string),
      ),
    );

    const nameByStudent = new Map<string, string>();

    if (studentIds.length > 0) {
      type StudentWithProfile = {
        id: string;
        profiles: ProfilesDisplayEmbed;
      };

      const { data: studentRows, error: stErr } = await sb
        .from("students")
        .select("id, profiles(full_name, preferred_name)")
        .in("id", studentIds);

      if (stErr) {
        console.error(
          "students for lifecycle events error",
          stErr,
        );
      }

      for (const s of (studentRows ?? []) as StudentWithProfile[]) {
        const sid = s.id;
        const name =
          readProfileDisplayName(
            s.profiles,
            sid.slice(0, 8) + "…",
          ) ?? sid.slice(0, 8) + "…";
        nameByStudent.set(sid, name);
      }
    }

    for (const ev of studentEvents) {
      if (!ev.is_auto) continue;

      const oldStatus = ev.old_status as string;
      const newStatus = ev.new_status as string;

      // 4) current → dormant
      if (oldStatus === "current" && newStatus === "dormant") {
        const studentName =
          nameByStudent.get(ev.student_id as string) ?? "A student";

        notifications.push({
          id: `student-${ev.id}`,
          variant: "info",
          title: `Student ${studentName} was auto-switched from current to dormant`,
          body:
            "Consider sending a reactivation email or moving this student to past if they don't return.",
          createdAt: ev.created_at as string,
        });
      }
    }
  }

  // Sort combined, newest first, and cap the list
  notifications.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime(),
  );

  return notifications.slice(0, 20);
}
