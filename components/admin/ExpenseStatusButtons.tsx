// components/admin/ExpenseStatusButtons.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  expenseId: number;
  currentStatus: "pending" | "approved" | "rejected";
};

export default function ExpenseStatusButtons({
  expenseId,
  currentStatus,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function updateStatus(targetStatus: "approved" | "rejected") {
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/teacher-expenses", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expenseId, status: targetStatus }),
        });

        const body = await res.json().catch(() => null);

        if (!res.ok || !body?.ok) {
          throw new Error(body?.error || "Failed to update");
        }

        // 🔁 Re-run the current route's server components,
        // which will re-query all the Supabase views.
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Failed to update");
      }
    });
  }

  const approving = isPending && currentStatus !== "approved";
  const rejecting = isPending && currentStatus !== "rejected";

  const isApproveDisabled =
    isPending || currentStatus === "approved" || currentStatus === "rejected";
  const isRejectDisabled =
    isPending || currentStatus === "rejected" || currentStatus === "approved";

  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isApproveDisabled}
          onClick={() => updateStatus("approved")}
          className="rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
        >
          {approving ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={isRejectDisabled}
          onClick={() => updateStatus("rejected")}
          className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
        >
          {rejecting ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
