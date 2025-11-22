"use client";

import { useState } from "react";
import { Tier } from "./TierBadge";

type Props = {
  studentId: string;
  initialTier: Tier;
};

export default function StudentTierSelector({ studentId, initialTier }: Props) {
  const [tier, setTier] = useState<Tier>(initialTier);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as "" | "basic" | "premium" | "elite";
    const nextTier: Tier = value === "" ? null : value;

    setTier(nextTier);
    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch("/api/admin/students/update-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          tier: value, // "" → NULL on the API
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || "Failed to update tier");
      }
      setMsg("Tier updated");
    } catch (err: any) {
      setMsg(err.message || "Error updating tier");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <label className="flex items-center gap-2">
        <span className="text-gray-500">Package tier:</span>
        <select
          className="rounded border px-2 py-1 text-xs"
          value={tier ?? ""}
          onChange={onChange}
          disabled={saving}
        >
          <option value="">No package (legacy rules)</option>
          <option value="basic">Basic (no free SNC)</option>
          <option value="premium">Premium (1 free SNC/month)</option>
          <option value="elite">Elite (1 free SNC/month)</option>
        </select>
      </label>
      {msg && <span className="text-[11px] text-gray-500">{msg}</span>}
    </div>
  );
}
