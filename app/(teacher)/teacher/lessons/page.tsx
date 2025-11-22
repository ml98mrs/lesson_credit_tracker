import { getServerSupabase } from "@/lib/supabase/server";
import { formatDateLondon, formatTimeLondon } from "@/lib/formatters";
// import DebugUser from "../_debug-user";

type LessonRow = {
  id: string;
  start_at: string;         // from view
  duration_min: number; // from view
  student_id: string;       // from view
  state: string;            // from view
  student_name?: string | null; // optional (for nicer label)
};

type ViewRow = {
  id: string;
  start_at: string;
  duration_min: number;
  student_id: string;
  state: string;
  student_name: string | null;
};

export default async function Page() {
  const sb = await getServerSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return <p>Please sign in.</p>;

  const { data: rows, error } = await sb
    .from("v_teacher_lessons")
    .select("id,start_at,duration_min,student_id,state,student_name")
    .eq("teacher_id", user.id)
    .order("start_at", { ascending: false })
    .limit(25);

  if (error) return <p className="text-red-600">Error: {error.message}</p>;

  const lessons: LessonRow[] = (rows ?? []).map((r: ViewRow) => ({
    id: r.id,
    start_at: r.start_at,
    duration_min: r.duration_min,
    student_id: r.student_id,
    state: r.state,
    student_name: r.student_name,
  }));

  if (lessons.length === 0) {
    return (
      <div className="space-y-4">
        {/* <DebugUser /> */}
        <p>No lessons yet.</p>
        <a className="underline" href="/teacher/lessons/new">Create your first lesson →</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* <DebugUser /> */}
      <h1 className="text-xl font-semibold">My recent lessons</h1>
      <ul className="divide-y rounded-xl border">
        {lessons.map((l) => {
          const studentLabel = l.student_name ?? (l.student_id?.slice(0, 8) + "…");
          return (
            <li key={l.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{studentLabel}</div>
                <div className="text-sm text-gray-600">
                  {formatDateLondon(l.start_at)} · {formatTimeLondon(l.start_at)} ·{" "}
                  {(l.duration_min / 60).toFixed(2)}h · {l.state}
                </div>
              </div>
              <a className="text-sm underline" href={`/teacher/lessons/${l.id}`}>Open</a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
