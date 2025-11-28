"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  expenseId: number;
};

export default function DeleteExpenseButton({ expenseId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm("Delete this expense claim?")) return;

    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/teacher/expenses", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expenseId }),
        });

        const body = await res.json().catch(() => null);

        if (!res.ok || !body?.ok) {
          throw new Error(body?.error || "Failed to delete expense");
        }

        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Failed to delete expense");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-red-600/20 hover:bg-red-100 disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
