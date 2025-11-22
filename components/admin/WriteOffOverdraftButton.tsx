"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMinutesAsHours } from "@/lib/formatters";

type Props = {
  studentId: string;
  overdraftMinutes: number; // negative number
};

export default function WriteOffOverdraftButton({
  studentId,
  overdraftMinutes,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (overdraftMinutes >= 0) return null;

  const debt = -overdraftMinutes;
  const debtHours = formatMinutesAsHours(debt);

  const handleClick = () => {
    const ok = window.confirm(
      `Write off ${debtHours} hours of overdraft (student owes ${debt} minutes) and mark as past?\n\nThis will zero the overdraft and log a write-off entry.`,
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/students/write-off-overdraft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId }),
        });

        const json = await res.json().catch(() => ({} as any));

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Failed to write off overdraft");
        }

        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Failed to write off overdraft");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {isPending
          ? "Writing off…"
          : `Write off overdraft (${debtHours} h) & mark as past`}
      </button>
      {error && (
        <span className="text-[10px] text-rose-600">{error}</span>
      )}
    </div>
  );
}
