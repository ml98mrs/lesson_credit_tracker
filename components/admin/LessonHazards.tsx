// components/admin/LessonHazards.tsx
"use client";

import { useEffect, useState } from "react";

export type LessonHazard = {
  lesson_id: string;
  allocation_id: string | null;
  hazard_type: string;
  severity: "red" | "amber" | "yellow" | "unknown" | string;
};


type Props = {
  lessonId: string;
};

function labelForHazard(h: LessonHazard): string {
  switch (h.hazard_type) {
    case "delivery_f2f_on_online":
      return "F2F lesson charged to ONLINE invoice";
    case "delivery_online_on_f2f":
      return "Online lesson charged to F2F invoice";
    case "length_too_short":
      return "Lesson shorter than package length";
    default:
      return h.hazard_type;
  }
}

function pillClasses(severity: string): string {
  switch (severity) {
    case "red":
      return "bg-rose-100 text-rose-800 border border-rose-300";
    case "amber":
    case "yellow":
      return "bg-amber-100 text-amber-800 border border-amber-300";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-300";
  }
}

export default function LessonHazards({ lessonId }: Props) {
  const [hazards, setHazards] = useState<LessonHazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);

  useEffect(() => {
  let cancelled = false;
  setErr(null);

  // If we somehow don't have a lessonId yet, don't hit the API
  if (!lessonId) {
    setHazards([]);
    setLoading(false);
    return () => {
      cancelled = true;
    };
  }

  setLoading(true);

  fetch(`/api/admin/hazards/by-lesson?lessonId=${encodeURIComponent(lessonId)}`)
    .then(async (r) => {
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || r.statusText);
      }
      return r.json();
    })
    .then((j) => {
      if (!cancelled) {
        setHazards((j.hazards ?? []) as LessonHazard[]);
      }
    })
    .catch((e) => {
      if (!cancelled) setErr(e.message);
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

  return () => {
    cancelled = true;
  };
}, [lessonId]);


async function onResolve(h: LessonHazard) {
  const key = `${h.hazard_type}:${h.allocation_id ?? "none"}`;
  setResolvingKey(key);
  setErr(null);

  try {
    const res = await fetch("/api/admin/hazards/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Delivery hazards: target = allocation
        allocationId: h.allocation_id ?? null,
        // Fallback for lesson-level hazards (if you add any later)
        lessonId: h.allocation_id ? null : h.lesson_id,
        hazardType: h.hazard_type,
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j.error || "Failed to resolve hazard");
    }

    // Remove from local list
    setHazards((prev) =>
      prev.filter(
        (x) =>
          !(
            x.hazard_type === h.hazard_type &&
            (x.allocation_id ?? null) === (h.allocation_id ?? null)
          )
      )
    );
  } catch (e: any) {
    setErr(e.message);
  } finally {
    setResolvingKey(null);
  }
}
  if (loading && hazards.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed p-3 text-xs text-gray-500">
        Checking hazards…
      </div>
    );
  }

  if (err && hazards.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        Failed to load hazards: {err}
      </div>
    );
  }

  if (hazards.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
        No unresolved hazards for this lesson.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border bg-white p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Lesson hazards</span>
        {err && (
          <span className="text-xs text-rose-700">
            {err}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {hazards.map((h) => {
          const key = `${h.hazard_type}:${h.allocation_id ?? "none"}`;
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5"
            >
              <div className="flex flex-col gap-1">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${pillClasses(
                  h.severity
                )}`}>
                  {labelForHazard(h)}
                </span>
                {h.allocation_id && (
                  <span className="text-[11px] text-gray-500">
                    Allocation: <span className="font-mono">{h.allocation_id}</span>
                  </span>
                )}
              </div>
            <button
  onClick={() => onResolve(h)}
  disabled={resolvingKey === key}
  className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-60"
>
  {resolvingKey === key ? "Resolving…" : "Mark resolved"}
</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
