// components/admin/MaintenancePanel.tsx
"use client";

import { useState } from "react";

type JsonValue = unknown;

export default function MaintenancePanel() {
  const [inactiveMonths, setInactiveMonths] = useState<number>(3);
  const [cleanupMonths, setCleanupMonths] = useState<number>(6);
  const [cleanupDryRun, setCleanupDryRun] = useState<boolean>(true);

  const [dormantResult, setDormantResult] = useState<JsonValue | null>(null);
  const [cleanupResult, setCleanupResult] = useState<JsonValue | null>(null);

  const [runningDormant, setRunningDormant] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);

  async function runDormantJob() {
    setRunningDormant(true);
    setDormantResult(null);
    try {
      const res = await fetch("/api/admin/maintenance/mark-dormant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inactiveInterval: `${inactiveMonths} months`,
        }),
      });

      const json: JsonValue = await res.json().catch(
        () => ({} as JsonValue),
      );
      setDormantResult(json);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setDormantResult({
          ok: false,
          error: e.message ?? "Unknown error",
        });
      } else {
        setDormantResult({ ok: false, error: "Unknown error" });
      }
    } finally {
      setRunningDormant(false);
    }
  }

  async function runCleanupJob() {
    setRunningCleanup(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/admin/maintenance/cleanup-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minAgeInterval: `${cleanupMonths} months`,
          dryRun: cleanupDryRun,
        }),
      });

      const json: JsonValue = await res.json().catch(
        () => ({} as JsonValue),
      );
      setCleanupResult(json);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setCleanupResult({
          ok: false,
          error: e.message ?? "Unknown error",
        });
      } else {
        setCleanupResult({ ok: false, error: "Unknown error" });
      }
    } finally {
      setRunningCleanup(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Dormant job */}
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              Mark inactive students as dormant
            </h2>
            <p className="text-xs text-gray-600">
              Calls <code>rpc_mark_students_dormant</code>: changes{" "}
              <strong>current</strong> students with no recent activity and
              non-negative remaining credit to <strong>dormant</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span>Inactive for at least</span>
            <input
              type="number"
              min={1}
              value={inactiveMonths}
              onChange={(e) =>
                setInactiveMonths(Number(e.target.value) || 1)
              }
              className="w-16 rounded-md border px-2 py-1 text-sm"
            />
            <span>months</span>
          </label>

          <button
            type="button"
            onClick={runDormantJob}
            disabled={runningDormant}
            className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {runningDormant ? "Running…" : "Run dormant job now"}
          </button>
        </div>

        {dormantResult !== null && (
  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] text-gray-800">
    {JSON.stringify(dormantResult, null, 2)}
  </pre>
)}

      </div>

      {/* Cleanup job */}
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              Cleanup old lessons for past students
            </h2>
            <p className="text-xs text-gray-600">
              Calls <code>rpc_cleanup_past_students_lessons</code>: deletes{" "}
              <strong>allocations</strong> and <strong>lessons</strong> for{" "}
              <strong>past</strong> students with zero remaining credit whose
              last activity is older than the selected age.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span>Older than</span>
            <input
              type="number"
              min={1}
              value={cleanupMonths}
              onChange={(e) =>
                setCleanupMonths(Number(e.target.value) || 1)
              }
              className="w-16 rounded-md border px-2 py-1 text-sm"
            />
            <span>months</span>
          </label>

          <label className="flex items-center gap-1 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={cleanupDryRun}
              onChange={(e) => setCleanupDryRun(e.target.checked)}
              className="h-3 w-3"
            />
            <span>Dry run only (don&apos;t delete)</span>
          </label>

          <button
            type="button"
            onClick={runCleanupJob}
            disabled={runningCleanup}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {runningCleanup
              ? "Running…"
              : cleanupDryRun
              ? "Run cleanup (dry run)"
              : "Run cleanup (delete)"}
          </button>
        </div>

       {cleanupResult !== null && (
  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] text-gray-800">
    {JSON.stringify(cleanupResult, null, 2)}
  </pre>
)}

      </div>
    </div>
  );
}
