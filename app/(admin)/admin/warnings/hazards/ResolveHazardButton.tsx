// app/(admin)/admin/hazards/ResolveHazardButton.tsx
"use client";

import { useState } from "react";

type Props = {
  hazardType: string;
  lessonId: string;
  allocationId: string | null;
};

export default function ResolveHazardButton({
  hazardType,
  lessonId,
  allocationId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setErr(null);

    try {
      const payload = {
        hazardType,
        // Exactly one non-null:
        lessonId: allocationId ? null : lessonId,
        allocationId: allocationId ?? null,
      };

      const res = await fetch("/api/admin/hazards/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || "Failed to resolve hazard");
      }

      // (optional) we can add a reload/refresh later
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-60"
      >
        {loading ? "Resolving…" : "Resolve"}
      </button>
      {err && (
        <span className="text-[11px] text-rose-600">
          {err}
        </span>
      )}
    </div>
  );
}
