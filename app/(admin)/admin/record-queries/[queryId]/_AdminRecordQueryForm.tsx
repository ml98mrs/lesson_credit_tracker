"use client";

import { useState } from "react";

type Props = {
  queryId: string;
  initialStatus: string;
  initialAdminNote: string;
  initialResolutionCode: string;
};

const STATUS_OPTIONS = ["open", "in_review", "resolved", "dismissed"];

export default function AdminRecordQueryForm({
  queryId,
  initialStatus,
  initialAdminNote,
  initialResolutionCode,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [adminNote, setAdminNote] = useState(initialAdminNote);
  const [resolutionCode, setResolutionCode] = useState(
    initialResolutionCode,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savePayload = async (payload: {
    status?: string;
    adminNote?: string;
    resolutionCode?: string | null;
  }) => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/record-queries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryId,
          status: payload.status ?? status,
          adminNote: payload.adminNote ?? adminNote,
          resolutionCode:
            payload.resolutionCode !== undefined
              ? payload.resolutionCode
              : resolutionCode || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save changes.");
      } else {
        setMessage("Saved.");
      }
    } catch (err) {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePayload({});
  };

  const onClear = async () => {
    // Mark as resolved + optional default resolution code
    const nextStatus = "resolved";
    setStatus(nextStatus);

    await savePayload({
      status: nextStatus,
      resolutionCode: resolutionCode || "no_change", // tweak if you like
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          className="w-full rounded border px-2 py-1 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600" htmlFor="resolutionCode">
          Resolution code (optional)
        </label>
        <input
          id="resolutionCode"
          className="w-full rounded border px-2 py-1 text-sm"
          value={resolutionCode}
          onChange={(e) => setResolutionCode(e.target.value)}
          placeholder="e.g. lesson_adjusted, credit_adjusted, no_change"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600" htmlFor="adminNote">
          Admin note (visible to student, if you choose to show it later)
        </label>
        <textarea
          id="adminNote"
          className="w-full rounded border px-2 py-1 text-sm"
          rows={4}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && <p className="text-xs text-emerald-700">{message}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        {/* NEW: Clear button */}
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          disabled={saving}
        >
          Clear query
        </button>
      </div>
    </form>
  );
}
