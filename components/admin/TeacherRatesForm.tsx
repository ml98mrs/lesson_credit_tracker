// components/admin/TeacherRatesForm.tsx
"use client";

import { useState } from "react";

type TeacherRateSummaryRow = {
  teacher_id: string;
  default_online_rate_pennies: number | null;
  f2f_basic_rate_pennies: number | null;
  f2f_premium_rate_pennies: number | null;
  num_f2f_overrides: number | null;
  min_override_rate_pennies: number | null;
  max_override_rate_pennies: number | null;
};

type OverrideRow = {
  teacher_id: string;
  student_id: string;
  student_name: string;
  f2f_rate_pennies: number;
};

type AssignedStudentOption = {
  id: string;
  name: string;
};

type Props = {
  teacherId: string;
  initialRateSummary: TeacherRateSummaryRow | null;
  overrides: OverrideRow[];
  assignedStudents: AssignedStudentOption[];
};

function penniesToPounds(pennies: number | null | undefined): string {
  if (pennies == null) return "";
  return (pennies / 100).toFixed(2);
}

export default function TeacherRatesForm({
  teacherId,
  initialRateSummary,
  overrides,
  assignedStudents,
}: Props) {
  const [onlineRate, setOnlineRate] = useState(
    penniesToPounds(initialRateSummary?.default_online_rate_pennies ?? null),
  );
  const [f2fBasicRate, setF2fBasicRate] = useState(
    penniesToPounds(initialRateSummary?.f2f_basic_rate_pennies ?? null),
  );
  const [f2fPremiumRate, setF2fPremiumRate] = useState(
    penniesToPounds(initialRateSummary?.f2f_premium_rate_pennies ?? null),
  );

  const [savingBase, setSavingBase] = useState(false);
  const [baseMessage, setBaseMessage] = useState<string | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [overrideRate, setOverrideRate] = useState<string>("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);

  async function saveBaseRates(e: React.FormEvent) {
    e.preventDefault();
    setSavingBase(true);
    setBaseMessage(null);

    try {
      const res = await fetch("/api/admin/teachers/rates/base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          defaultOnlineRatePounds: onlineRate,
          f2fBasicRatePounds: f2fBasicRate,
          f2fPremiumRatePounds: f2fPremiumRate,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to save rates");
      }

      setBaseMessage("Base rates saved.");
    } catch (err: unknown) {
  if (err instanceof Error) {
    setBaseMessage(err.message || "Error saving base rates.");
  } else {
    setBaseMessage("Error saving base rates.");
  }
} finally {
  setSavingBase(false);
}

  }

  async function saveOverride(e: React.FormEvent) {
    e.preventDefault();
    setSavingOverride(true);
    setOverrideMessage(null);

    try {
      const res = await fetch("/api/admin/teachers/rates/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          studentId: selectedStudentId || null,
          f2fRatePounds: overrideRate,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to save override");
      }

      setOverrideMessage("Override saved. Reload the page to see changes.");
   } catch (err: unknown) {
  if (err instanceof Error) {
    setOverrideMessage(err.message || "Error saving override.");
  } else {
    setOverrideMessage("Error saving override.");
  }
} finally {
  setSavingOverride(false);
}

  }

  async function deleteOverride(studentId: string) {
    if (!confirm("Remove F2F override for this student?")) return;

    try {
      const res = await fetch("/api/admin/teachers/rates/override", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, studentId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete override");
      }

      setOverrideMessage("Override deleted. Reload the page to see changes.");
    } catch (err: unknown) {
  if (err instanceof Error) {
    setOverrideMessage(err.message || "Error deleting override.");
  } else {
    setOverrideMessage("Error deleting override.");
  }
}

  }

  return (
    <div className="space-y-8 text-xs">
      {/* Base rates */}
      <form onSubmit={saveBaseRates} className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-sm font-semibold mb-1">Base rates</h2>
        <p className="text-[11px] text-gray-500 mb-2">
          All rates are per hour. Stored in pennies internally; shown here as £/h.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-gray-600">Online (£/h)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={onlineRate}
              onChange={(e) => setOnlineRate(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-gray-600">
              F2F (legacy/basic) (£/h)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={f2fBasicRate}
              onChange={(e) => setF2fBasicRate(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-gray-600">
              F2F (premium/elite) (£/h)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={f2fPremiumRate}
              onChange={(e) => setF2fPremiumRate(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingBase}
          className="mt-2 rounded border bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {savingBase ? "Saving…" : "Save base rates"}
        </button>

        {baseMessage && (
          <div className="mt-2 text-[11px] text-gray-700">{baseMessage}</div>
        )}
      </form>

      {/* Overrides list */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-sm font-semibold mb-2">
          Student-specific F2F overrides
        </h2>
        {overrides.length === 0 ? (
          <p className="text-[11px] text-gray-500">
            No overrides yet. All students use the base F2F rates.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">F2F rate (£/h)</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.teacher_id + o.student_id} className="border-b">
                    <td className="py-2 pr-4">{o.student_name}</td>
                    <td className="py-2 pr-4">
                      £{(o.f2f_rate_pennies / 100).toFixed(2)}/h
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => deleteOverride(o.student_id)}
                        className="text-[11px] text-rose-700 underline"
                      >
                        Remove override
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / update override */}
      <form
        onSubmit={saveOverride}
        className="rounded-2xl border p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold mb-1">
          Add / update F2F override
        </h2>
        <p className="text-[11px] text-gray-500 mb-1">
          Choose a student and set a special F2F rate for this teacher. This
          overrides the base F2F rates for that student only.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-gray-600">Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded border px-2 py-1"
              required
            >
              <option value="">Select student…</option>
              {assignedStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-gray-600">F2F rate (£/h)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={overrideRate}
              onChange={(e) => setOverrideRate(e.target.value)}
              className="rounded border px-2 py-1"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingOverride}
          className="mt-2 rounded border bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {savingOverride ? "Saving…" : "Save override"}
        </button>

        {overrideMessage && (
          <div className="mt-2 text-[11px] text-gray-700">
            {overrideMessage}
          </div>
        )}
      </form>
    </div>
  );
}
