// app/(admin)/admin/students/new/NewStudentForm.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type TeacherOption = {
  id: string;
  name: string;
};

type Props = {
  teacherOptions: TeacherOption[];
};

export default function NewStudentForm({ teacherOptions }: Props) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [timezone, setTimezone] = useState("Europe/London");
  const [tier, setTier] = useState<"" | "basic" | "premium" | "elite">("");
  const [teacherId, setTeacherId] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          preferredName: preferredName || undefined,
          timezone,
          tier: tier || null,
          teacherId: teacherId || null,
        }),
      });

      if (!res.ok) {
  const body = await res.json().catch(() => null);
  console.error("Create student failed", res.status, body);

  const msg =
    (body?.details as string | undefined) ||
    (body?.error as string | undefined) ||
    `Failed to create student (status ${res.status})`;

  setError(msg);
  setIsSubmitting(false);
  return;
}


      const data = (await res.json()) as { studentId: string };
      router.push(`/admin/students/${data.studentId}`);
    } catch (err) {
      console.error(err);
      setError("Unexpected error while creating student.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <p className="text-xs text-gray-500">
          This is the login email for the student&apos;s account.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">Full name</label>
        <input
          type="text"
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Preferred name (optional)
        </label>
        <input
          type="text"
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={preferredName}
          onChange={(e) => setPreferredName(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          Used in the UI; full name is still stored for records.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">Timezone</label>
        <input
          type="text"
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          Must match a code in your <code>timezones</code> table (e.g.
          Europe/London).
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">Tier</label>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={tier}
          onChange={(e) =>
            setTier(e.target.value as "" | "basic" | "premium" | "elite")
          }
        >
          <option value="">No tier yet</option>
          <option value="basic">basic</option>
          <option value="premium">premium</option>
          <option value="elite">elite</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Primary teacher (optional)
        </label>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">No teacher yet</option>
          {teacherOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? "Creating…" : "Create student"}
        </button>
      </div>
    </form>
  );
}
