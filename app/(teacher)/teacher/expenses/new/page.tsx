// app/(teacher)/teacher/expenses/new/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Section from "@/components/ui/Section";
import type { StudentStatus } from "@/lib/enums";

type Category = "drinks" | "teaching_resources" | "other";

type TeacherStudentOption = {
  id: string;
  name: string;
  status: StudentStatus;
};

export default function NewTeacherExpensePage() {
  const router = useRouter();

  const [incurredAt, setIncurredAt] = useState("");
  const [amount, setAmount] = useState(""); // pounds string
  const [category, setCategory] = useState<Category>("drinks");
  const [description, setDescription] = useState("");
  const [studentId, setStudentId] = useState(""); // selected student
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<TeacherStudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  // Load the teacher's assigned students (current + dormant)
  useEffect(() => {
    let cancelled = false;
    setStudentsLoading(true);
    setStudentsError(null);

    fetch("/api/teacher/students/assigned")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Failed to load students.");
        }
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        const options = (body.students ?? []) as TeacherStudentOption[];
        setStudents(options);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setStudentsError(
          err?.message || "Could not load your assigned students.",
        );
      })
      .finally(() => {
        if (!cancelled) setStudentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNumber = parseFloat(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Please enter a positive amount.");
      return;
    }

    if (!incurredAt) {
      setError("Please choose the date the expense was incurred.");
      return;
    }

    if (!studentId.trim()) {
      setError("Please choose the student this expense is for.");
      return;
    }

    if (
      (category === "teaching_resources" || category === "other") &&
      !description.trim()
    ) {
      setError("Please add details for this type of expense.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/teacher/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incurredAt, // "YYYY-MM-DD"
          amountPounds: amountNumber,
          category,
          description: description.trim() || null,
          studentId, // required
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          body?.error || "Something went wrong while logging the expense.",
        );
      }

      router.push("/teacher/expenses");
    } catch (err: any) {
      setError(err.message || "Unexpected error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Section
      title="Log a new expense"
      subtitle="Submit an expense claim. For drinks at cafe expense claims, one expense per lesson. Please ensure the date matches the date of lesson."
    >
      <div className="mb-4 flex justify-end">
        <Link
          href="/teacher/expenses"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          ← Back to expenses
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mt-2 max-w-md space-y-4">
        <div>
          <label
            htmlFor="incurredAt"
            className="block text-sm font-medium text-gray-700"
          >
            Date incurred
          </label>
          <input
            id="incurredAt"
            type="date"
            value={incurredAt}
            onChange={(e) => setIncurredAt(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700"
          >
            Amount (£)
          </label>
          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
          <p className="mt-1 text-xs text-gray-500" />
        </div>

        <div>
          <label
            htmlFor="studentId"
            className="block text-sm font-medium text-gray-700"
          >
            Student
          </label>

          <select
            id="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
            disabled={studentsLoading || students.length === 0}
          >
            <option value="">
              {studentsLoading
                ? "Loading your students…"
                : students.length === 0
                ? "No assigned students available"
                : "Select a student"}
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.status === "dormant" ? " (dormant)" : ""}
              </option>
            ))}
          </select>

          {studentsError && (
            <p className="mt-1 text-xs text-red-600">{studentsError}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700"
          >
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          >
            <option value="drinks">Drinks</option>
            <option value="teaching_resources">
              Teaching resources (please add details)
            </option>
            <option value="other">Other (please specify)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Details (except for drinks)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={
              category === "drinks"
                ? "e.g. texbook, special expense agreed with office"
                : "Please describe what this expense was for."
            }
          />
        </div>

        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {submitting ? "Submitting…" : "Submit expense"}
          </button>
        </div>
      </form>
    </Section>
  );
}
