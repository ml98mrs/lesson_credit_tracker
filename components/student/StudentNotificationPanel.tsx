// components/student/StudentNotificationPanel.tsx
"use client";

import { useState } from "react";

export type StudentDashboardNotification = {
  id: string;        // query id
  title: string;
  body?: string;
  createdAt?: string; // ISO
};

type Props = {
  initialNotifications: StudentDashboardNotification[];
};

export default function StudentNotificationPanel({ initialNotifications }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [pending, setPending] = useState<string | null>(null);

  const handleMarkRead = async (id: string) => {
    setPending(id);

    try {
      // Fire-and-forget-ish; if it fails, we just keep the notification
      const res = await fetch("/api/student/record-queries/mark-seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryId: id }),
      });

      if (!res.ok) {
        // Optional: you could show a toast or message here
        console.error("Failed to mark notification as read");
        setPending(null);
        return;
      }

      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPending(null);
    } catch (err) {
      console.error(err);
      setPending(null);
    }
  };

  if (!notifications.length) return null;

  return (
    <section
      aria-label="Notifications"
      className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Updates from admin
        </h2>
        <a
          href="/student/queries"
          className="text-[11px] font-medium text-slate-600 underline-offset-2 hover:underline"
        >
          View all queries
        </a>
      </header>

      <div className="space-y-3">
        {notifications.map((n) => (
          <article
            key={n.id}
            className="flex items-start justify-between gap-3 rounded-lg border-l-4 border-emerald-300 bg-white p-3 shadow-sm"
          >
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900">
                {n.title}
              </div>

              {n.body && (
                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">
                  {n.body}
                </p>
              )}

              {n.createdAt && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {new Date(n.createdAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  London time
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleMarkRead(n.id)}
              disabled={pending === n.id}
              className="ml-2 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-60"
            >
              {pending === n.id ? "Saving…" : "Mark as read"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
