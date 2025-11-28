// app/(admin)/admin/analytics/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";

export const dynamic = "force-dynamic";

const cards = [
  {
    href: "/admin/analytics/revenue-cost",
    title: "Revenue vs cost",
    subtitle: "Margin by teacher, tier, and lesson length.",
    body: "Break down revenue, teacher pay, drinks allocation, and margins at both teacher-month and lesson level. Filter by month, teacher, student, delivery, tier, and length.",
  },
  {
    href: "/admin/analytics/snc",
    title: "SNC & cancellation behaviour",
    subtitle: "Short-notice cancellations by student, teacher, and tier.",
    body: "See who generates the most SNCs, how free vs charged SNCs are used, and the revenue impact of cancellations across your portfolio.",
  },
  {
    href: "/admin/analytics/expiry",
    title: "Credit expiry & risk",
    subtitle: "Upcoming expiries and unused credit.",
    body: "Monitor which lots are close to expiry, where mandatory policies may bite, and which students or companies are at risk of losing paid credit.",
  },
  {
    href: "/admin/analytics/timezones",
    title: "Student timezones & local hours",
    subtitle: "Where students are and when they learn.",
    body: "See how many students you have in each timezone and when they tend to take lessons in their local time, filtered by lifecycle status (current, dormant, past). Useful for scheduling, staffing, and future cohort planning.",
  },
  {
    href: "/admin/analytics/cohorts",
    title: "Student cohorts & reactivation",
    subtitle: "New-student cohorts and long-term engagement.",
    body: "Track new-student cohorts by month, tier, and first teacher. See how many stay active over 3, 6, and 12 months, how many hours they use, and where reactivation behaviour appears.",
  },
];

export default function AnalyticsHubPage() {
  return (
    <Section
      title="Analytics control panel"
      subtitle="Jump into deeper views of revenue, SNC behaviour, credit expiry, student timezones, and cohorts."
    >
      {/* Tiny red accent strip to echo the logo */}
      <div className="mb-4 h-1 w-16 rounded-full bg-red-600" />

      <p className="mb-6 text-xs text-gray-600">
        Use these analytics views to support business development, pricing, and
        operational decisions. Filters and exports live on the individual pages.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm transition hover:border-red-300 hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {card.title}
              </h2>
              {/* subtle red pill for “analytics” flavour */}
              <span className="whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                Analytics
              </span>
            </div>
            <p className="mb-2 text-xs font-medium text-gray-700">
              {card.subtitle}
            </p>
            <p className="text-xs text-gray-600">{card.body}</p>

            <span className="mt-3 inline-flex items-center text-xs font-medium text-red-700 group-hover:underline">
              Open view
              <span className="ml-1 text-[10px]">→</span>
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
