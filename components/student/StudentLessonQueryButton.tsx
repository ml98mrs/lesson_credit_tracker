// components/student/StudentLessonQueryButton.tsx
"use client";

import { useState } from "react";

type Props = {
  lessonId: string;
  summary: string; // e.g. "12 Mar 2025 – 60 min – Jane Smith"
};

export default function StudentLessonQueryButton({ lessonId, summary }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!body.trim()) {
      setError("Please add a short explanation.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/student/record-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, body }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setSuccess(true);
        setBody("");
        // Close after a little delay
        setTimeout(() => setOpen(false), 1000);
      }
    } catch (err: unknown) {
      console.error("StudentLessonQueryButton submit error", err);
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="rounded border px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
        onClick={() => setOpen(true)}
      >
        Query
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Query this lesson</h2>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-800"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        <p className="mb-2 text-[11px] text-gray-500">{summary}</p>

        <form onSubmit={onSubmit} className="space-y-2">
          <label className="block text-[11px] text-gray-600">
            Your question / what seems wrong?
            <textarea
              className="mt-1 w-full rounded border px-2 py-1 text-xs"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </label>

          {error && (
            <p className="text-[11px] text-red-600">
              {error}
            </p>
          )}

          {success && (
            <p className="text-[11px] text-emerald-700">
              Query sent. We&apos;ll review and update you.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded border px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-gray-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Send query"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
