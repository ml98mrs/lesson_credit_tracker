// components/admin/ExpenseStatusButtons.tsx
"use client";

import { useState } from "react";

type Props = {
  expenseId: number;
  currentStatus: "pending" | "approved" | "rejected";
};

export default function ExpenseStatusButtons({ expenseId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState<null | "approve" | "reject" | "reset">(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(nextStatus: "pending" | "approved" | "rejected") {
    setLoading(
      nextStatus === "approved" ? "approve" :
      nextStatus === "rejected" ? "reject" :
      "reset",
    );
    setError(null);
    try {
      const res = await fetch("/api/admin/teacher-expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseId, status: nextStatus }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to update");
      setStatus(nextStatus);
    } catch (e: any) {
      setError(e.message || "Error updating status");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex gap-1">
        <button
          type="button"
          onClick={() => updateStatus("approved")}
          disabled={loading !== null}
          className="rounded border border-green-600 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
        >
          {loading === "approve" ? "Saving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => updateStatus("rejected")}
          disabled={loading !== null}
          className="rounded border border-red-600 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {loading === "reject" ? "Saving…" : "Reject"}
        </button>
        {status !== "pending" && (
          <button
            type="button"
            onClick={() => updateStatus("pending")}
            disabled={loading !== null}
            className="rounded border border-gray-400 px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading === "reset" ? "Saving…" : "Reset"}
          </button>
        )}
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
