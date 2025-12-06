"use client";

import { useState } from "react";
import { formatDateTimeLondon } from "@/lib/formatters";

export type NotificationVariant = "info" | "warning" | "success" | "error";

export type DashboardNotification = {
  id: string; // unique per notification instance
  variant?: NotificationVariant;
  title: string;
  body?: string;
  createdAt?: string; // ISO string (UTC)
};

type NotificationPanelProps = {
  initialNotifications: DashboardNotification[];
};

const variantAccent: Record<NotificationVariant, string> = {
  info: "border-sky-300",
  warning: "border-amber-300",
  success: "border-emerald-300",
  error: "border-red-300",
};

export function NotificationPanel({
  initialNotifications,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<DashboardNotification[]>(
    initialNotifications,
  );

  const handleClear = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (!notifications.length) return null;

  return (
    <section
      aria-label="Notifications"
      className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Notifications
        </h2>
      </header>

      <div className="space-y-3">
        {notifications.map((n) => {
          const variant = n.variant ?? "info";

          return (
            <article
              key={n.id}
              className={`flex items-start justify-between gap-3 rounded-lg border-l-4 bg-white p-3 shadow-sm ${variantAccent[variant]}`}
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  {n.title}
                </div>

                {n.body && (
                  <p className="mt-1 text-xs text-slate-600">{n.body}</p>
                )}

                {n.createdAt && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatDateTimeLondon(n.createdAt)} (London time)
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleClear(n.id)}
                className="ml-2 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                Clear
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
