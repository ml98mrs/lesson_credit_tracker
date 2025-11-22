"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Section from "@/components/ui/Section";

type Category = "drinks" | "teaching_resources" | "other";

export default function NewTeacherExpensePage() {
  const router = useRouter();
  const [incurredAt, setIncurredAt] = useState("");
  const [amount, setAmount] = useState(""); // pounds string
  const [category, setCategory] = useState<Category>("drinks");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Please enter a positive amount.");
      return;
    }
    if (!incurredAt) {
      setError("Please choose the date the expense was incurred.");
      return;
    }

    if (
      (category === "teaching_resources" || category === "other") &&
      (!description.trim())
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
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error || "Something went wrong while logging the expense.");
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
      subtitle="Submit an expense claim. Admin will review and mark it as approved or rejected."
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
            placeholder="4.50"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter the total cost in pounds (e.g. 3.80).
          </p>
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
            Details
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={
              category === "drinks"
                ? "e.g. Coffee during lesson at Café X"
                : "Please describe what this expense was for"
            }
          />
          <p className="mt-1 text-xs text-gray-500">
            Required for teaching resources and other expenses.
          </p>
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
