"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMinutesAsHours, formatDateTimeLondon } from "@/lib/formatters";

export type AllocationRow = {
  id: string;
  credit_lot_id: string;
  lesson_id: string | null;
  minutes_allocated: number;
  created_at?: string | null;
};

type Props = {
  allocations: AllocationRow[];
};

export default function LotAllocations({ allocations }: Props) {
  const [open, setOpen] = useState(false);

  if (!allocations.length) {
    // No allocations for this lot – nothing to show
    return (
      <div className="text-xs text-gray-500 italic">
        No confirmed lessons allocated to this credit yet.
      </div>
    );
  }

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-1 underline hover:no-underline"
      >
        {open
          ? `Hide usage (${allocations.length} allocation${
              allocations.length > 1 ? "s" : ""
            })`
          : `View usage (${allocations.length} allocation${
              allocations.length > 1 ? "s" : ""
            })`}
      </button>

      {open && (
        <div className="mt-1 rounded-lg border p-2 bg-gray-50">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-2">Lesson</th>
                <th className="py-1 pr-2">Minutes</th>
                <th className="py-1 pr-2">Allocated at</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-1 pr-2">
                    {a.lesson_id ? (
                      <Link
                        href={`/admin/lessons/review?lessonId=${a.lesson_id}`}
                        className="underline hover:no-underline"
                      >
                        {a.lesson_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1 pr-2">
                    {formatMinutesAsHours(a.minutes_allocated)} h
                  </td>
                  <td className="py-1 pr-2">
  {a.created_at ? formatDateTimeLondon(a.created_at) : "—"}
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
