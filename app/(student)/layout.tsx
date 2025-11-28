// app/(student)/layout.tsx
import Link from "next/link";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4 text-sm">
          <div className="flex gap-4">
            <Link href="/student/dashboard">Student Dashboard</Link>
            <Link href="/student/credit">Credit lots</Link>
            <Link href="/student/lessons">Lessons confirmed</Link>
            <Link href="/student/uptake">Uptake</Link>
          
          </div>

          {/* Reuse the same sign-out UX as Admin */}
          <AdminSignOutButton />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 flex-1">{children}</main>
    </div>
  );
}
