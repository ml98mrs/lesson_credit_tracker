"use client";

import { useEffect, useMemo, useState } from "react";
import Section from "@/components/ui/Section";
import { supabase } from "@/lib/supabase/client";
import { formatDateTimeUK } from "@/lib/formatters";
import LessonTypeBadge from "@/components/lessons/LessonTypeBadge";

type User = { id: string; email?: string | null };

type AssignedStudent = {
  id: string; // student_id
  name: string; // profiles.full_name
};

type LessonRow = {
  id: string;
  student_id: string;
  occurred_at: string;
  duration_min: number;
  delivery: "online" | "f2f";
  state: "pending" | "confirmed" | "declined";
  is_snc: boolean;
};

type LogLessonPayload = {
  studentId: string;
  occurredAt: string; // ISO string
  durationMin: number;
  delivery: "online" | "f2f";
  isSnc: boolean;
  notes?: string;
};

async function logLesson(payload: LogLessonPayload) {
  const res = await fetch("/api/teacher/lessons/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Failed to log lesson");
  }

  return data; // { ok: true, lessonId: ... } per your API
}


export default function NewLesson() {
  const [user, setUser] = useState<User | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [studentId, setStudentId] = useState<string>("");
  const [date, setDate] = useState<string>(""); // yyyy-mm-dd
  const [time, setTime] = useState<string>(""); // HH:mm (local)
  const [delivery, setDelivery] = useState<"online" | "f2f">("online");
  const [durationMin, setDurationMin] = useState<number>(60); // 60 online, 90 f2f
  const [isSNC, setIsSNC] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  const [recent, setRecent] = useState<LessonRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Bootstrap teacher + assigned students
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);

      const { data: userRes } = await supabase.auth.getUser();
      const u = userRes.user
        ? { id: userRes.user.id, email: userRes.user.email }
        : null;

      if (!u) {
        setMsg("You must be signed in as a teacher.");
        setLoading(false);
        return;
      }
      setUser(u);

      // Find teacher row
      const { data: tRows, error: tErr } = await supabase
        .from("teachers")
        .select("id")
        .eq("profile_id", u.id)
        .limit(1);

      if (tErr || !tRows?.[0]) {
        setMsg("No teacher record found for this user.");
        setLoading(false);
        return;
      }

      const tId = tRows[0].id as string;
      setTeacherId(tId);

      // Assigned students
      const { data: stRows, error: stErr } = await supabase
        .from("student_teacher")
        .select(
          `
          student_id,
          students (
            id,
            profile_id,
            profiles ( full_name )
          )
        `,
        )
        .eq("teacher_id", tId);

      if (stErr) {
        setMsg(stErr.message);
        setLoading(false);
        return;
      }

      const assigned: AssignedStudent[] =
        (stRows ?? []).map((r: any) => ({
          id: r.students?.id,
          name: r.students?.profiles?.full_name ?? "(no name)",
        })) || [];

      setStudents(assigned);
      if (assigned[0]?.id) setStudentId(assigned[0].id);

      setLoading(false);
      await refreshRecent(tId);
    })();
  }, []);

  

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
async function refreshRecent(tId: string) {
  setRecentLoading(true);

const { data, error } = await supabase
  .from("lessons")
  .select(
    "id, student_id, occurred_at, duration_min, delivery, state, is_snc"
  )
  .eq("teacher_id", tId)
  .eq("state", "pending")           // ⬅ pending only
  .order("occurred_at", { ascending: false })
  .limit(10);

  if (!error && data) {
    setRecent(data as LessonRow[]);
  } else if (error) {
    console.error("refreshRecent error", error);
    setMsg(error.message);
  }

  setRecentLoading(false);
}



  const occurredAtISO = useMemo(() => {
    if (!date || !time) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const local = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);
    return local.toISOString(); // store UTC
  }, [date, time]);

async function handleDelete(lessonId: string) {
  if (!teacherId) return;

  setMsg(null);

  // Optimistically remove from UI
  setRecent((prev) => prev.filter((r) => r.id !== lessonId));

  // Mark as declined in DB
  const { error } = await supabase
    .from("lessons")
    .update({ state: "declined" })
    .eq("id", lessonId)
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("Failed to delete lesson", error);
    setMsg(error.message);

    // Restore by reloading if something went wrong
    await refreshRecent(teacherId);
  }
}



  function formatDateUTC(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setMsg(null);

  // 🔒 hard guard against double-clicks / spam
  if (submitting) return;

  if (!teacherId) return;
  if (!studentId) return setMsg("Please select a student.");
  if (!occurredAtISO) return setMsg("Please choose date and time.");
  if (durationMin <= 0) return setMsg("Duration must be greater than 0.");
  if (durationMin < 10) {
    return setMsg("Duration must be at least 10 minutes.");
  }

  setSubmitting(true);
  try {
    await logLesson({
      studentId,
      occurredAt: occurredAtISO,
      durationMin,
      delivery,
      isSnc: isSNC,
      notes: notes.trim() || undefined,
    });

    setMsg(isSNC ? "SNC logged." : "Lesson logged (pending).");

    // Reset SNC checkbox + notes (keep other fields for speed)
    setIsSNC(false);
    setNotes("");

    await refreshRecent(teacherId);
  } catch (err: any) {
    setMsg(err?.message || "Failed to log lesson.");
  } finally {
    setSubmitting(false);
  }
}


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Section
      title="Log lesson"
      
    >
      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : (
        <form onSubmit={onSubmit} className="max-w-xl space-y-4">
          {msg && <p className="text-sm text-rose-700">{msg}</p>}

          {/* Student selector */}
          <div className="flex flex-col gap-1">
            <label className="text-sm">Student</label>
            <select
              className="border rounded px-3 py-2"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm">Date of Lesson</label>
              <input
                className="border rounded px-3 py-2"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Time</label>
              <input
                className="border rounded px-3 py-2"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Delivery + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm">Delivery</label>
              <select
                className="border rounded px-3 py-2"
                value={delivery}
                onChange={(e) => {
                  const value = e.target.value as "online" | "f2f";
                  setDelivery(value);
                  // Auto-default minutes: 60 for online, 90 for F2F
                  setDurationMin(value === "f2f" ? 90 : 60);
                }}
              >
                <option value="online">Online</option>
                <option value="f2f">Face to face</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm">Duration (minutes)</label>
              <input
  className="border rounded px-3 py-2"
  type="number"
  min={10}                // ⬅ minimum 10 minutes
  value={durationMin}
  onChange={(e) =>
    setDurationMin(parseInt(e.target.value, 10) || 0)
  }
/>

              
            </div>
          </div>

          {/* SNC toggle */}
          <div className="flex items-center gap-2">
            <input
              id="snc"
              type="checkbox"
              checked={isSNC}
              onChange={(e) => setIsSNC(e.target.checked)}
            />
            <label htmlFor="snc" className="text-sm">
              Short-notice cancellation (SNC)
            </label>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-sm">Notes (optional)</label>
            <textarea
              className="border rounded px-3 py-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <button
  type="submit"
  disabled={submitting}
  className={`rounded bg-black px-4 py-2 text-sm font-medium text-white ${
    submitting ? "opacity-60 cursor-not-allowed" : ""
  }`}
>
  {submitting ? "Saving…" : "Save lesson"}
</button>
        </form>
      )}

{/* ------------------------------------------------------------------- */}
{/* Recent lessons                                                     */}
{/* ------------------------------------------------------------------- */}
<div className="mt-10">
  <h2 className="text-lg font-semibold">My recent lessons</h2>
  {recentLoading ? (
    <p className="text-sm text-gray-600 mt-2">Loading…</p>
  ) : recent.length === 0 ? (
    <p className="text-sm text-gray-600 mt-2">No lessons yet.</p>
  ) : (
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Date of Lesson (UTC)</th>
            <th className="py-2 pr-4">Delivery</th>
            <th className="py-2 pr-4">Duration</th>
            <th className="py-2 pr-4">State</th>
            <th className="py-2 pr-4">SNC</th>
            <th className="py-2 pr-4">Action</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2 pr-4">
                {formatDateUTC(r.occurred_at)}
              </td>
              <td className="py-2 pr-4">
                {r.delivery === "f2f" ? "F2F" : "Online"}
              </td>
              <td className="py-2 pr-4">{r.duration_min} min</td>

              {/* State text, e.g. Pending */}
              <td className="py-2 pr-4 capitalize">
                {r.state.replace("_", " ")}
              </td>

              {/* SNC badge */}
              <td className="py-2 pr-4">
                <LessonTypeBadge isSnc={r.is_snc} />
              </td>

              {/* Delete action */}
              <td className="py-2 pr-4">
                <button
                  type="button"
                  className="text-rose-600 hover:underline text-xs"
                  onClick={() => handleDelete(r.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>


    </Section>
  );
}
