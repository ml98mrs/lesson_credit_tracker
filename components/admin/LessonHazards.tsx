// components/admin/LessonHazards.tsx
"use client";

import { useEffect, useState } from "react";

import { AlertBanner } from "@/components/ui/AlertBanner";
import { StatusPill } from "@/components/ui/StatusPill";
import type { UiSeverity } from "@/lib/ui/severity";

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
      return "F2F lesson charged to ONLINE-only credit";
    case "delivery_online_on_f2f":
      return "Online lesson charged to F2F-only credit";
    case "length_too_short":
      return "Lesson shorter than package length";
    case "length_restriction_mismatch":
      return "Lesson shorter than this credit lot’s minimum length";
    case "overdraft_allocation":
      return "Lesson confirmed using overdraft (negative balance)";
    case "snc_overuse":
      return "Too many SNCs this month";
    default:
      return h.hazard_type;
  }
}

/**
 * Map DB-level severity to UI severity tokens.
 * - "red"    → warningCritical (serious business risk)
 * - "amber"/"yellow" → warningSoft (heads-up)
 * - anything else → info (neutral)
 */
function toUiSeverity(raw: LessonHazard["severity"]): UiSeverity {
  switch (raw) {
    case "red":
      return "warningCritical";
    case "amber":
    case "yellow":
      return "warningSoft";
    default:
      return "info";
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

    fetch(
      `/api/admin/hazards/by-lesson?lessonId=${encodeURIComponent(
        lessonId,
      )}`,
    )
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
            ),
        ),
      );
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("An unknown error occurred");
      }
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
      <div className="mt-4">
        <AlertBanner severity="error">
          <strong>Failed to load hazards:</strong>{" "}
          <span>{err}</span>
        </AlertBanner>
      </div>
    );
  }

  if (hazards.length === 0) {
    return (
      <div className="mt-4">
        <AlertBanner severity="success">
          No unresolved hazards for this lesson.
        </AlertBanner>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border bg-white p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Lesson hazards</span>
        {err && (
          <StatusPill
            severity="error"
            label={err}
            className="text-[11px]"
          />
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
                <StatusPill
                  severity={toUiSeverity(h.severity)}
                  label={labelForHazard(h)}
                  className="text-[11px]"
                />
                {h.allocation_id && (
                  <span className="text-[11px] text-gray-500">
                    Allocation:{" "}
                    <span className="font-mono">
                      {h.allocation_id}
                    </span>
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
