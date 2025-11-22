// components/admin/WriteOffRemainingButton.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMinutesAsHours } from "@/lib/formatters";

type Props = {
  studentId: string;
  remainingMinutes: number; // DB minutes (> 0 for this button to show)
};

export default function WriteOffRemainingButton({
  studentId,
  remainingMinutes,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (remainingMinutes <= 0) {
    return null;
  }

  const remainingHours = formatMinutesAsHours(remainingMinutes);

  const handleClick = () => {
    setError(null);

    const ok = window.confirm(
      `Write off ${remainingHours} hours (${remainingMinutes} minutes) of remaining credit and mark this student as past?\n\nThis will zero out their remaining positive credit and add a write-off entry for the accountant.`,
    );

    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(
          "/api/admin/students/write-off-remaining",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId,
              reasonCode: "manual_write_off",
            }),
          },
        );

        const json = await res.json().catch(() => ({} as any));

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Failed to write off credit");
        }

        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Failed to write off credit");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {isPending
          ? "Writing off…"
          : `Write off ${remainingHours} h & mark as past`}
      </button>
      {error && (
        <span className="text-[10px] text-rose-600">{error}</span>
      )}
    </div>
  );
}
