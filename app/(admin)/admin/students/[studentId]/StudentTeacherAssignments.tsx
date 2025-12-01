"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TeacherOption = { id: string; name: string };

type Props = {
  studentId: string;
  allTeachers: TeacherOption[];
  assignedTeachers: TeacherOption[];
};

export default function StudentTeacherAssignments({
  studentId,
  allTeachers,
  assignedTeachers,
}: Props) {
  const router = useRouter();
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const assignedIds = new Set(assignedTeachers.map((t) => t.id));
  const availableTeachers = allTeachers.filter((t) => !assignedIds.has(t.id));

  async function callApi(
    url: string,
    payload: { studentId: string; teacherId: string }
  ) {
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg =
        (body?.details as string | undefined) ||
        (body?.error as string | undefined) ||
        `Request failed (${res.status})`;
      throw new Error(msg);
    }
  }

  async function handleAssign() {
    if (!selectedTeacherId) return;
    const teacherId = selectedTeacherId;
    setBusyId(`assign-${teacherId}`);

    try {
      await callApi("/api/admin/student-teachers/assign", {
        studentId,
        teacherId,
      });
      setSelectedTeacherId("");
      router.refresh();
    } catch (err: unknown) {
  console.error(err);
  if (err instanceof Error) {
    setError(err.message ?? "Failed to assign teacher.");
  } else {
    setError("Failed to assign teacher.");
  }
} finally {
  setBusyId(null);
}

  }

  async function handleUnassign(teacherId: string) {
    setBusyId(`unassign-${teacherId}`);

    try {
      await callApi("/api/admin/student-teachers/unassign", {
        studentId,
        teacherId,
      });
      router.refresh();
   } catch (err: unknown) {
  console.error(err);

  if (err instanceof Error) {
    setError(err.message ?? "Failed to unassign teacher.");
  } else {
    setError("Failed to unassign teacher.");
  }
} finally {
  setBusyId(null);
}

  }

  return (
    <div className="rounded-2xl border bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-sm">Teacher assignments</h2>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Assigned list */}
      {assignedTeachers.length === 0 ? (
        <p className="mb-3 text-xs text-gray-600">
          No teachers assigned to this student.
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {assignedTeachers.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1"
            >
              <span>{t.name}</span>
              <button
                type="button"
                onClick={() => handleUnassign(t.id)}
                disabled={busyId === `unassign-${t.id}`}
                className="text-[11px] rounded border px-2 py-0.5 hover:bg-white disabled:opacity-50"
              >
                {busyId === `unassign-${t.id}` ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Assign control */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="min-w-[180px] rounded-md border px-2 py-1 text-xs"
          value={selectedTeacherId}
          onChange={(e) => setSelectedTeacherId(e.target.value)}
        >
          <option value="">Select teacher…</option>
          {availableTeachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAssign}
          disabled={!selectedTeacherId || !!busyId}
          className="text-[11px] rounded border border-black bg-black px-3 py-1 text-white disabled:opacity-50"
        >
          {busyId?.startsWith("assign-") ? "Assigning…" : "Assign teacher"}
        </button>
      </div>

      {allTeachers.length === 0 && (
        <p className="mt-2 text-[11px] text-gray-500">
          No teachers exist yet. Create a teacher from the Teachers page first.
        </p>
      )}
    </div>
  );
}
