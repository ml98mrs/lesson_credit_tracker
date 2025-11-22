"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  studentId: string;
  hasOverdraft: boolean; // e.g. remainingMin < 0
};

export default function SettleOverdraftButton({ studentId, hasOverdraft }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!hasOverdraft) return null;

  async function onClick() {
    if (!studentId) return;
    const ok = window.confirm(
      "Settle overdraft for this student? This will convert the current negative balance into used credit (no extra usable credit will be added)."
    );
    if (!ok) return;

    setLoading(true);
    setMsg(null);
    setErr(null);

    try {
      const res = await fetch("/api/admin/credit-lots/settle-overdraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to settle overdraft");
      }

      setMsg("Overdraft settled. Refreshing…");
      // Refresh the Student page so the numbers update
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-md bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
      >
        {loading ? "Settling overdraft…" : "Settle overdraft"}
      </button>
      {msg && <span className="text-xs text-emerald-700">{msg}</span>}
      {err && <span className="text-xs text-rose-700">{err}</span>}
    </div>
  );
}
