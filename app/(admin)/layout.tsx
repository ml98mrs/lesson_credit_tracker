import type { ReactNode } from "react";
import Link from "next/link";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";
import AdminGlobalSearch from "@/components/admin/admin-global-search";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* TOP NAV BAR */}
      <nav className="border-b">
        <div className="max-w-6xl mx-auto p-4 flex flex-wrap items-center justify-between gap-4 text-sm">
          {/* LEFT LINKS */}
          <div className="flex flex-wrap gap-4">
            <Link href="/admin/dashboard">Admin Dashboard</Link>
            <Link href="/admin/lessons/queue">Review queue</Link>
            <Link href="/admin/lessons/confirmed">Confirmed lessons</Link>
            <Link href="/admin/students">Students</Link>
            <Link href="/admin/teachers">Teachers</Link>
            <Link href="/admin/credit-invoices/import">Credit import</Link>
            <Link href="/admin/reports/credit-usage">Reports</Link>
            <Link href="/admin/settings/pricing-tiers">Settings</Link>
          </div>

          {/* RIGHT SIDE: SEARCH + SIGN OUT */}
          <div className="flex items-center gap-3">
            <AdminGlobalSearch />
            <AdminSignOutButton />
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto p-4 flex-1">{children}</main>
    </div>
  );
}
