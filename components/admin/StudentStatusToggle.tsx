// components/admin/StudentStatusToggle.tsx
"use client";

import { useState, useTransition } from "react";

type Status = "current" | "dormant" | "past";

type Props = {
  studentId: string;
  initialStatus: Status;
  remainingMinutes: number; // can be positive, zero, or negative
};

export default function StudentStatusToggle({
  studentId,
  initialStatus,
  remainingMinutes,
}: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

const handleChange = (next: Status) => {
    // Guard: don’t allow setting to "past" while there is any non-zero balance
    if (next === "past" && remainingMinutes !== 0) {
      window.alert(
        "You cannot mark this student as past while they still have a non-zero credit balance.\n\n" +
          "If they have unused credit, write it off using the red button.\n" +
          "If they have a negative balance/overdraft, settle or write that off first.",
      );
      return;
    }

    const previous = status;
    setStatus(next);
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/students/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, status: next }),
        });

        const json = await res.json().catch(() => ({} as any));

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Failed to update status");
        }
     } catch (e: unknown) {
  if (e instanceof Error) {
    setError(e.message ?? "Failed to update status");
  } else {
    setError("Failed to update status");
  }
  setStatus(previous);
}

    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as Status)}
        className="rounded-md border px-2 py-1 text-xs"
        disabled={isPending}
      >
        <option value="current">Current student</option>
        <option value="dormant">Dormant (needs review)</option>
        <option value="past">Past student</option>
      </select>
      {isPending && (
        <span className="text-[10px] text-gray-500">Saving…</span>
      )}
      {error && (
        <span className="text-[10px] text-rose-600">{error}</span>
      )}
    </div>
  );
}
