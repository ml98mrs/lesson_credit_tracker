"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SetTeacherPastButtonProps = {
  teacherId: string;
  disabled?: boolean;
};

export function SetTeacherPastButton({
  teacherId,
  disabled,
}: SetTeacherPastButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClick = () => {
    if (disabled || isPending) return;

    const confirmed = window.confirm(
      "Mark this teacher as past? They will no longer appear in active lists, but their history will be preserved.",
    );
    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/teachers/set-status?teacherId=${encodeURIComponent(
            teacherId,
          )}&status=past`,
          {
            method: "POST",
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to update teacher status");
        }

        // Re-fetch server data for this page
        router.refresh();
     } catch (err: unknown) {
  console.error(err);

  if (err instanceof Error) {
    setError(err.message ?? "Failed to update teacher status");
  } else {
    setError("Failed to update teacher status");
  }
}

    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className="rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Updating…" : "Set teacher to past"}
      </button>
      {error && (
        <p className="text-[11px] text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
