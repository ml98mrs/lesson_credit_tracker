"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMinutesAsHours, formatDateTimeLondon } from "@/lib/formatters";
import type { Delivery, SncMode } from "@/lib/enums";
import { formatDeliveryLabel as formatDeliveryLabelBase } from "@/lib/domain/lessons";

export type AllocationRow = {
  id: string;
  credit_lot_id: string;
  lesson_id: string | null;
  minutes_allocated: number;
  created_at?: string | null;

  lesson_occurred_at?: string | null;
  lesson_duration_min?: number | null;
  lesson_delivery?: Delivery | null;
  lesson_is_snc?: boolean | null;
  lesson_snc_mode?: SncMode | null;
  student_full_name?: string | null;
  teacher_full_name?: string | null;
};

type Props = {
  allocations: AllocationRow[];
  variant: "admin" | "student";
  lotId?: string; // 👈 NEW (optional so existing callers don't break)
};

// Wrap the shared formatter so we handle null/undefined cleanly.
const formatDeliveryLabel = (delivery?: Delivery | null): string => {
  if (!delivery) return "—";
  return formatDeliveryLabelBase(delivery);
};

const formatSncLabel = (isSnc?: boolean | null, mode?: SncMode | null) => {
  if (!isSnc) return "No";
  if (mode === "free") return "Yes (free)";
  if (mode === "charged") return "Yes (charged)";
  return "Yes";
};

export function LotAllocationsTable({ allocations, variant, lotId }: Props) {

  const [open, setOpen] = useState(false);

  if (!allocations.length) {
    return (
      <div className="text-xs italic text-gray-500">
        No confirmed lessons allocated to this credit yet.
      </div>
    );
  }

  const showStudentCol = variant === "admin"; // admin sees student + teacher
  const showLessonLink = variant === "admin"; // only admin can open lesson

  const toggleLabel = open ? "Hide usage" : "View usage";
  const countLabel = `${allocations.length} allocation${
    allocations.length > 1 ? "s" : ""
  }`;

  return (
  <div className="text-xs">
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="mb-1 underline hover:no-underline"
    >
      {toggleLabel} ({countLabel})
    </button>

    {open && (
      <div className="mt-1 rounded-lg border bg-gray-50 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] text-gray-600">Usage details</span>
          {lotId && (
            <Link
              href={`/api/export/allocations/${encodeURIComponent(lotId)}`}
              className="text-[11px] text-blue-700 underline"
            >
              Download (.xlsx)
            </Link>
          )}
        </div>

        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1 pr-2">Lesson</th>
              {showStudentCol && <th className="py-1 pr-2">Student</th>}
              <th className="py-1 pr-2">Teacher</th>
              <th className="py-1 pr-2">Delivery</th>
              <th className="py-1 pr-2">SNC</th>
              <th className="py-1 pr-2">Lesson date</th>
              <th className="py-1 pr-2 text-right">Lesson length</th>
              <th className="py-1 pr-2 text-right">Allocated (h)</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => {
              const isSpliced =
                a.lesson_duration_min != null &&
                a.lesson_duration_min > 0 &&
                a.minutes_allocated < a.lesson_duration_min;

              const lessonLabel = a.lesson_id ?? "—";

              return (
                <tr key={a.id} className="border-b last:border-0">
                  {/* Lesson ID / label */}
                  <td className="py-1 pr-2">
                    {showLessonLink && a.lesson_id ? (
                      <Link
                        href={`/admin/lessons/review?lessonId=${a.lesson_id}`}
                        className="underline hover:no-underline"
                      >
                        {lessonLabel}
                      </Link>
                    ) : (
                      lessonLabel
                    )}
                  </td>

                  {/* Student (admin only) */}
                  {showStudentCol && (
                    <td className="py-1 pr-2">
                      {a.student_full_name ?? "—"}
                    </td>
                  )}

                  {/* Teacher */}
                  <td className="py-1 pr-2">
                    {a.teacher_full_name ?? "—"}
                  </td>

                  {/* Delivery / SNC */}
                  <td className="py-1 pr-2">
                    {formatDeliveryLabel(a.lesson_delivery)}
                  </td>
                  <td className="py-1 pr-2">
                    {formatSncLabel(
                      a.lesson_is_snc,
                      a.lesson_snc_mode ?? null,
                    )}
                  </td>

                  {/* Lesson date */}
                  <td className="py-1 pr-2">
                    {a.lesson_occurred_at
                      ? formatDateTimeLondon(a.lesson_occurred_at)
                      : "—"}
                  </td>

                  {/* Length + splice hint */}
                  <td className="py-1 pr-2 text-right">
                    {a.lesson_duration_min != null
                      ? `${a.lesson_duration_min} min`
                      : "—"}
                    {isSpliced && (
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {`${a.minutes_allocated} min from this lot (lesson split across lots)`}
                      </div>
                    )}
                  </td>

                  {/* Allocated hours */}
                  <td className="py-1 pr-2 text-right">
                    {formatMinutesAsHours(a.minutes_allocated)} h
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

}
