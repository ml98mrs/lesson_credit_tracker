#!/usr/bin/env bash
# next-app-scaffold.sh — create the /app folder skeleton, layouts, and placeholder pages
# Usage: save as scripts/next-app-scaffold.sh then run:
#   bash scripts/next-app-scaffold.sh .
# It will create files that don't exist, and skip ones that already do.
# Target: Next.js App Router (TypeScript). Assumes a Next.js project root with an /app directory.

set -euo pipefail

ROOT=${1:-.}

if [ ! -d "$ROOT/app" ]; then
  echo "✖ This expects a Next.js (App Router) project with an /app directory. Create one first (e.g. npx create-next-app@latest)."
  exit 1
fi

echo "→ Scaffolding UI skeleton under $ROOT/app"

write() {
  local path="$ROOT/$1"
  mkdir -p "$(dirname "$path")"
  if [ -f "$path" ]; then
    echo "skip  $1 (exists)"
  else
    cat >"$path"
    echo "create $1"
  fi
}

# -----------------------------
# Shared utilities & components
# -----------------------------

write "lib/formatters.ts" <<'TS'
// lib/formatters.ts
// Single source of truth for units & dates

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export function formatMoneyFromPennies(pennies: number): string {
  const pounds = pennies / 100; // display only
  return GBP.format(pounds);
}

export function formatHoursFromMinutes(mins: number): string {
  const hours = Math.round((mins / 60) * 100) / 100; // 2dp, half-up via Math.round
  return `${hours.toFixed(2)} h`;
}

export function formatMinutes(mins: number): string {
  return `${mins} min`;
}

/**
 * Format a UTC ISO string as dd.mm.yyyy in Europe/London time
 */
export function formatDateUK(isoUtc: string | Date): string {
  const d = typeof isoUtc === 'string' ? new Date(isoUtc) : isoUtc;
  // Render via en-GB and swap "/" to "." to enforce dd.mm.yyyy
  const base = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric' });
  return base.replaceAll('/', '.');
}

export function formatDateTimeUK(isoUtc: string | Date): string {
  const d = typeof isoUtc === 'string' ? new Date(isoUtc) : isoUtc;
  const date = formatDateUK(d);
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}
TS

write "components/ui/Section.tsx" <<'TSX'
// components/ui/Section.tsx
export default function Section({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <section className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
TSX

write "components/badges/HazardBadge.tsx" <<'TSX'
// components/badges/HazardBadge.tsx
export default function HazardBadge({ kind }: { kind: 'counter-delivery' | 'length-violation' | 'negative-balance' }) {
  const m = {
    'counter-delivery': { label: 'Counter-delivery', color: 'bg-amber-200 text-amber-900' },
    'length-violation': { label: 'Length violation', color: 'bg-rose-200 text-rose-900' },
    'negative-balance': { label: 'Negative balance', color: 'bg-red-200 text-red-900' },
  }[kind];
  return <span className={`px-2 py-1 rounded text-xs font-medium ${m.color}`}>{m.label}</span>;
}
TSX

write "components/banners/LowCreditBanner.tsx" <<'TSX'
// components/banners/LowCreditBanner.tsx
import { formatHoursFromMinutes } from '@/lib/formatters';

export default function LowCreditBanner({ remainingMin }: { remainingMin: number }) {
  if (remainingMin > 360) return null;
  return (
    <div className="max-w-5xl mx-auto mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      Low credit warning: {formatHoursFromMinutes(remainingMin)} remaining.
    </div>
  );
}
TSX

write "components/banners/ExpirySoonBanner.tsx" <<'TSX'
// components/banners/ExpirySoonBanner.tsx
import { formatDateUK } from '@/lib/formatters';

export default function ExpirySoonBanner({ expiryDateUtc }: { expiryDateUtc?: string }) {
  if (!expiryDateUtc) return null;
  const soon = true; // placeholder condition — wire to real logic via view later
  if (!soon) return null;
  return (
    <div className="max-w-5xl mx-auto mt-2 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sky-900">
      Credit expiry approaching: {formatDateUK(expiryDateUtc)}
    </div>
  );
}
TSX

write "components/misc/CreditMeter.tsx" <<'TSX'
// components/misc/CreditMeter.tsx
import { formatHoursFromMinutes } from '@/lib/formatters';

export default function CreditMeter({ grantedMin, usedMin }: { grantedMin: number; usedMin: number }) {
  const remaining = Math.max(grantedMin - usedMin, 0);
  const pct = Math.min(100, Math.max(0, (remaining / Math.max(grantedMin, 1)) * 100));
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between text-sm mb-1">
        <span>Remaining: {formatHoursFromMinutes(remaining)}</span>
        <span>Used: {formatHoursFromMinutes(usedMin)} / Total: {formatHoursFromMinutes(grantedMin)}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-3 bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
TSX

# -----------------------------
# Root layout and error pages
# -----------------------------

write "app/layout.tsx" <<'TSX'
// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Credit Tracker',
  description: 'Language school credit tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
TSX

write "app/404.tsx" <<'TSX'
// app/404.tsx
export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto p-10 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you are looking for doesn’t exist.</p>
    </main>
  );
}
TSX

write "app/500.tsx" <<'TSX'
// app/500.tsx
export default function Error500() {
  return (
    <main className="max-w-3xl mx-auto p-10 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-gray-600">Please try again or contact support.</p>
    </main>
  );
}
TSX

# -----------------------------
# (public) routes
# -----------------------------

write "app/(public)/login/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';

export default function LoginPage() {
  return (
    <Section title="Sign in" subtitle="Use your email to get a magic link">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">(Auth UI placeholder)</p>
      </div>
    </Section>
  );
}
TSX

write "app/(public)/session-expired/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';

export default function SessionExpired() {
  return (
    <Section title="Session expired" subtitle="Please sign in again.">
      <a className="inline-block px-4 py-2 rounded bg-black text-white" href="/login">Go to login</a>
    </Section>
  );
}
TSX

write "app/(public)/help/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';

export default function HelpPage() {
  return (
    <Section title="Help & FAQs">
      <ul className="list-disc ml-6 space-y-2 text-sm">
        <li>Students can view credit, lessons, and expiry warnings.</li>
        <li>Teachers can log lessons and expenses; invoices are generated monthly.</li>
        <li>Admins review lessons, confirm allocations, and manage policies.</li>
      </ul>
    </Section>
  );
}
TSX

write "app/(public)/privacy/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function Privacy() {
  return <Section title="Privacy">(Placeholder)</Section>;
}
TSX

write "app/(public)/terms/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function Terms() {
  return <Section title="Terms">(Placeholder)</Section>;
}
TSX

# -----------------------------
# (student) routes
# -----------------------------

write "app/(student)/layout.tsx" <<'TSX'
// app/(student)/layout.tsx
import Link from 'next/link';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b">
        <div className="max-w-6xl mx-auto p-4 flex gap-4 text-sm">
          <Link href="/student/dashboard">Dashboard</Link>
          <Link href="/student/credit">Credit</Link>
          <Link href="/student/lessons">Lessons</Link>
          <Link href="/student/uptake">Uptake</Link>
          <Link href="/student/invoices">Invoices</Link>
          <Link href="/student/profile">Profile</Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
TSX

write "app/(student)/student/dashboard/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
import LowCreditBanner from '@/components/banners/LowCreditBanner';
import ExpirySoonBanner from '@/components/banners/ExpirySoonBanner';
import CreditMeter from '@/components/misc/CreditMeter';

export default function StudentDashboard() {
  // Placeholder numbers for now; wire to views later
  const grantedMin = 3600; // 60h
  const usedMin = 1200; // 20h
  const remainingMin = grantedMin - usedMin;
  const expiryDateUtc = new Date().toISOString();

  return (
    <>
      <LowCreditBanner remainingMin={remainingMin} />
      <ExpirySoonBanner expiryDateUtc={expiryDateUtc} />
      <Section title="Your credit">
        <CreditMeter grantedMin={grantedMin} usedMin={usedMin} />
      </Section>
    </>
  );
}
TSX

write "app/(student)/student/credit/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';

export default function StudentCredit() {
  return (
    <Section title="Credit lots" subtitle="Purchases and awards with remaining time (hours)">
      <div className="text-sm text-gray-600">(Table placeholder)</div>
    </Section>
  );
}
TSX

write "app/(student)/student/lessons/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';

export default function StudentLessons() {
  return (
    <Section title="Lessons" subtitle="Each row displays minutes and any hazards">
      <div className="text-sm text-gray-600">(Table placeholder)</div>
    </Section>
  );
}
TSX

write "app/(student)/student/uptake/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function StudentUptake() {
  return <Section title="Lesson uptake">(Chart placeholder)</Section>;
}
TSX

write "app/(student)/student/invoices/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function StudentInvoices() {
  return <Section title="Your purchases">(Read-only invoice list placeholder)</Section>;
}
TSX

write "app/(student)/student/profile/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function StudentProfile() { return <Section title="Profile">(Update profile placeholder)</Section>; }
TSX

# -----------------------------
# (teacher) routes
# -----------------------------

write "app/(teacher)/layout.tsx" <<'TSX'
import Link from 'next/link';
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b">
        <div className="max-w-6xl mx-auto p-4 flex gap-4 text-sm">
          <Link href="/teacher/dashboard">Dashboard</Link>
          <Link href="/teacher/lessons">Lessons</Link>
          <Link href="/teacher/students">Students</Link>
          <Link href="/teacher/expenses">Expenses</Link>
          <Link href="/teacher/invoices">Invoices</Link>
          <Link href="/teacher/profile">Profile</Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
TSX

write "app/(teacher)/teacher/dashboard/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherDashboard() { return <Section title="Teacher dashboard">(Today & MTD summary)</Section>; }
TSX

write "app/(teacher)/teacher/lessons/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherLessonsIndex() { return <Section title="My lessons">(Tabs: Pending / Confirmed / SNC)</Section>; }
TSX

write "app/(teacher)/teacher/lessons/new/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function NewLesson() { return <Section title="Log lesson">(Form placeholder)</Section>; }
TSX

write "app/(teacher)/teacher/lessons/[lessonId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherLessonDetail() { return <Section title="Lesson detail">(Minutes, allocations, hazards)</Section>; }
TSX

write "app/(teacher)/teacher/students/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherStudents() { return <Section title="My students">(Remaining credit peek)</Section>; }
TSX

write "app/(teacher)/teacher/students/[studentId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherStudentDetail() { return <Section title="Student credit">(Summary and recent lessons)</Section>; }
TSX

write "app/(teacher)/teacher/expenses/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherExpensesIndex() { return <Section title="Expenses">(List + add)</Section>; }
TSX

write "app/(teacher)/teacher/expenses/new/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function NewExpense() { return <Section title="Add expense">(Form placeholder)</Section>; }
TSX

write "app/(teacher)/teacher/invoices/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherInvoicesIndex() { return <Section title="My invoices">(List)</Section>; }
TSX

write "app/(teacher)/teacher/invoices/current-month/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function CurrentMonthInvoice() { return <Section title="Current month (draft)">(Auto-assembled)</Section>; }
TSX

write "app/(teacher)/teacher/invoices/[invoiceId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherInvoiceDetail() { return <Section title="Invoice detail">(Lines & submit)</Section>; }
TSX

write "app/(teacher)/teacher/profile/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function TeacherProfile() { return <Section title="Profile">(Update profile placeholder)</Section>; }
TSX

# -----------------------------
# (admin) routes
# -----------------------------

write "app/(admin)/layout.tsx" <<'TSX'
import Link from 'next/link';
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b">
        <div className="max-w-6xl mx-auto p-4 flex flex-wrap gap-4 text-sm">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/lessons/queue">Review queue</Link>
          <Link href="/admin/students">Students</Link>
          <Link href="/admin/teachers">Teachers</Link>
          <Link href="/admin/credit-invoices/import">Credit import</Link>
          <Link href="/admin/reports/credit-usage">Reports</Link>
          <Link href="/admin/settings/pricing-tiers">Settings</Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
TSX

write "app/(admin)/admin/dashboard/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function AdminDashboard() { return <Section title="Admin dashboard">(KPIs & alerts)</Section>; }
TSX

# Lessons
write "app/(admin)/admin/lessons/queue/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function ReviewQueue() { return <Section title="Pending lessons">(Review & bulk actions)</Section>; }
TSX

write "app/(admin)/admin/lessons/[lessonId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function AdminLessonReview() { return <Section title="Review lesson">(Edit fields & allocation preview)</Section>; }
TSX

write "app/(admin)/admin/lessons/confirmed/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function ConfirmedLessons() { return <Section title="Confirmed lessons">(Exportable table)</Section>; }
TSX

write "app/(admin)/admin/lessons/cancelled-snc/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function CancelledSNC() { return <Section title="SNC ledger">(Who paid / minutes deducted)</Section>; }
TSX

# Allocations detail
write "app/(admin)/admin/allocations/[lessonId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function AllocationBreakdown() { return <Section title="Allocations">(Split across lots + audit)</Section>; }
TSX

# Students
write "app/(admin)/admin/students/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function StudentsIndex() { return <Section title="Students">(Search & filters)</Section>; }
TSX

write "app/(admin)/admin/students/[studentId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function Student360() { return <Section title="Student 360">(Credit, lessons, warnings, policies)</Section>; }
TSX

write "app/(admin)/admin/students/[studentId]/credit-lots/new/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function NewCreditLot() { return <Section title="New credit lot">(Invoice import / award)</Section>; }
TSX

write "app/(admin)/admin/students/[studentId]/credit-lots/[creditLotId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function CreditLotDetail() { return <Section title="Credit lot detail">(Granted, remaining, constraints)</Section>; }
TSX

write "app/(admin)/admin/students/[studentId]/lessons/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function StudentLessonsAdmin() { return <Section title="Student lessons">(Scope to student)</Section>; }
TSX

write "app/(admin)/admin/students/[studentId]/policies/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function StudentPolicies() { return <Section title="Policies">(Per-student overrides e.g. SNC)</Section>; }
TSX

# Teachers
write "app/(admin)/admin/teachers/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeachersIndex() { return <Section title="Teachers">(List & pending invoices)</Section>; }
TSX

write "app/(admin)/admin/teachers/[teacherId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function Teacher360Admin() { return <Section title="Teacher 360">(Rates, lessons, invoices, expenses)</Section>; }
TSX

write "app/(admin)/admin/teachers/[teacherId]/rates/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function TeacherRates() { return <Section title="Pay rates">(£/hour → stored pennies/hour)</Section>; }
TSX

write "app/(admin)/admin/teachers/[teacherId]/invoices/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherInvoicesAdmin() { return <Section title="Teacher invoices">(List)</Section>; }
TSX

write "app/(admin)/admin/teachers/[teacherId]/invoices/[invoiceId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherInvoiceAdminDetail() { return <Section title="Invoice detail">(Approve/pay)</Section>; }
TSX

write "app/(admin)/admin/teachers/[teacherId]/expenses/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function TeacherExpensesAdmin() { return <Section title="Expenses">(Review & reimburse)</Section>; }
TSX

# Credit invoices (Xero imports)
write "app/(admin)/admin/credit-invoices/import/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function CreditImport() { return <Section title="Import credit from Xero">(Ref + minutes + constraints)</Section>; }
TSX

write "app/(admin)/admin/credit-invoices/[refOrId]/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function CreditInvoiceDetail() { return <Section title="Credit invoice">(Linked credit lot)</Section>; }
TSX

# Reports
write "app/(admin)/admin/reports/credit-usage/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function ReportCreditUsage() { return <Section title="Credit usage">(Sold vs used, hours)</Section>; }
TSX

write "app/(admin)/admin/reports/low-credit/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function ReportLowCredit() { return <Section title="Low credit">(≤ 360 min)</Section>; }
TSX

write "app/(admin)/admin/reports/expiry/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function ReportExpiry() { return <Section title="Expiry (30 days)">(Lots approaching expiry)</Section>; }
TSX

write "app/(admin)/admin/reports/uptake/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function ReportUptake() { return <Section title="Lesson uptake">(Frequency vs target)</Section>; }
TSX

write "app/(admin)/admin/reports/revenue-cost/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function ReportRevenueCost() { return <Section title="Revenue vs cost">(Delivery/tier/length)</Section>; }
TSX

# Settings
write "app/(admin)/admin/settings/pricing-tiers/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function SettingsPricingTiers() { return <Section title="Pricing tiers">(basic/premium/elite)</Section>; }
TSX

write "app/(admin)/admin/settings/snc-policy/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function SettingsSNC() { return <Section title="SNC policy">(Defaults & allowances)</Section>; }
TSX

write "app/(admin)/admin/settings/expiry-policy/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function SettingsExpiry() { return <Section title="Expiry policy">(none/default/advisory)</Section>; }
TSX

write "app/(admin)/admin/settings/enums/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function SettingsEnums() { return <Section title="Enums & lookups">(Manage if needed)</Section>; }
TSX

write "app/(admin)/admin/settings/rbac/page.tsx" <<'TSX'
'use client';
import Section from '@/components/ui/Section';
export default function SettingsRBAC() { return <Section title="Roles & access">(Assign profiles → role)</Section>; }
TSX

write "app/(admin)/admin/settings/audit-log/page.tsx" <<'TSX'
import Section from '@/components/ui/Section';
export default function AuditLog() { return <Section title="Audit log">(Who did what, when)</Section>; }
TSX

# -----------------------------
# Optional: middleware guard placeholder (non-functional skeleton)
# -----------------------------
write "middleware.ts" <<'TS'
// middleware.ts (placeholder)
// Later: read session cookie, route to /student, /teacher, or /admin based on role
export function middleware() {}
TS

echo "\n✓ Scaffold complete. Next steps:"
echo " - Wire pages to Supabase queries (RSC) and RPC actions (Client forms)."
echo " - Replace placeholders with real tables/views once DB is ready."
echo " - Keep all unit/date formatting via lib/formatters.ts for hydration-safe SSR."
