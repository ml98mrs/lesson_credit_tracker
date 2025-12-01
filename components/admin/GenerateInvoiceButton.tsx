"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  teacherId: string;
  monthStart: string; // 'YYYY-MM-DD'
  compact?: boolean;
};

export default function GenerateInvoiceButton({
  teacherId,
  monthStart,
  compact,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/teacher-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, monthStart }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error || "Failed to generate invoice");
      }

      if (body?.invoiceId) {
        // Go straight to the detail page
        router.push(`/admin/teachers/${teacherId}/invoices/${body.invoiceId}`);
      } else {
        router.refresh();
      }
    } catch (e: unknown) {
  if (e instanceof Error) {
    setError(e.message || "Error generating invoice");
  } else {
    setError("Error generating invoice");
  }
} finally {
  setLoading(false);
}

  }

  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          compact
            ? "rounded-md border border-blue-600 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            : "rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        }
      >
        {loading ? "Generating…" : "Generate invoice"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
