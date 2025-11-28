// app/(admin)/admin/warnings/page.tsx
import Link from "next/link";

type WarningSection = {
  key: string;
  title: string;
  description: string;
  href: string;
  emphasis?: "high" | "medium" | "low";
};

const WARNING_SECTIONS: WarningSection[] = [
  {
    key: "credit-expiring",
    title: "Credit expiring soon",
    description:
      "Credit lots that are approaching their expiry date. Review and decide whether to extend, write off, or contact the student.",
    href: "/admin/warnings/credit-expiring",
    emphasis: "medium",
  },
  {
    key: "low-credit",
    title: "Low-credit students",
    description:
      "Students whose remaining credit is below your threshold. Use this list to plan renewal nudges and avoid service interruptions.",
    href: "/admin/warnings/low-credit",
    emphasis: "medium",
  },
  {
    key: "overdraft",
    title: "Overdraft / negative balance",
    description:
      "Students whose lessons have used overdraft credit and now have a negative balance. Prioritise write-offs, top-ups, or plan changes.",
    href: "/admin/warnings/overdraft",
    emphasis: "high",
  },
  {
    key: "hazards",
    title: "Lesson allocation hazards",
    description:
      "Overdraft usage, delivery mismatches, length mismatches, and other allocation hazards that need explicit admin review.",
    href: "/admin/warnings/hazards",
    emphasis: "high",
  },
  {
    key: "cancelled-snc",
    title: "Cancelled SNC lessons",
    description:
      "Short-notice cancellations that may need checking (tier rules, free/charged SNC logic, and teacher fairness).",
    href: "/admin/warnings/cancelled-snc",
    emphasis: "low",
  },
];

function emphasisClasses(emphasis: WarningSection["emphasis"]) {
  switch (emphasis) {
    case "high":
      return "border-red-400/70 bg-red-50/60";
    case "medium":
      return "border-amber-300/70 bg-amber-50/60";
    case "low":
    default:
      return "border-slate-200 bg-slate-50";
  }
}

export default function WarningsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Warnings &amp; problem-solving
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          A central place for operational issues that need admin attention:
          expiring and low credit, overdraft usage, lesson allocation hazards,
          and SNC cancellations. Use the sections below to drill down and
          resolve problems.
        </p>
      </header>

      <section aria-label="Warning categories">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {WARNING_SECTIONS.map((section) => (
            <article
              key={section.key}
              className={[
                "flex flex-col justify-between rounded-xl border p-4 shadow-sm transition hover:shadow-md hover:-translate-y-px",
                emphasisClasses(section.emphasis),
              ].join(" ")}
            >
              <div className="space-y-2">
                <h2 className="text-base font-semibold">{section.title}</h2>
                <p className="text-sm text-slate-700">
                  {section.description}
                </p>

                {/* Placeholder for future counts / severity badges */}
                {/* e.g. <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                      12 items
                    </span> */}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={section.href}
                  className="inline-flex items-center text-sm font-medium text-slate-900 underline underline-offset-4 hover:no-underline"
                >
                  Open section
                  <span aria-hidden className="ml-1">
                    →
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
