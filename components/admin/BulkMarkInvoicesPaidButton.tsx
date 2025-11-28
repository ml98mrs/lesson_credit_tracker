// components/admin/BulkMarkInvoicesPaidButton.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  monthStart: string; // 'YYYY-MM-01'
  generatedCount: number;
};

export default function BulkMarkInvoicesPaidButton({
  monthStart,
  generatedCount,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (generatedCount === 0) {
    return (
      <span className="text-[11px] text-gray-500">
        No open invoices to mark as paid for this month.
      </span>
    );
  }

  function handleClick() {
    if (
      !window.confirm(
        `Mark ${generatedCount} open invoice(s) for this month as paid?`,
      )
    ) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(
          "/api/admin/teacher-invoices/bulk-mark-paid",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ monthStart }),
          },
        );

        const body = await res.json().catch(() => null);

        if (!res.ok || !body?.ok) {
          throw new Error(body?.error || "Failed to mark invoices as paid");
        }

        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Failed to mark invoices as paid");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md bg-green-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
      >
        {isPending
          ? "Marking as paid…"
          : `Mark ${generatedCount} open invoice${
              generatedCount === 1 ? "" : "s"
            } as paid`}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
