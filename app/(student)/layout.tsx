// app/(student)/layout.tsx
"use client";

import Link from "next/link";
import SignOutButton from "@/components/auth/SignOutButton";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <nav className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4 text-sm">
          <div className="flex gap-4">
            <Link href="/student/dashboard">Student Dashboard</Link>
            <Link href="/student/credit">Credit lots</Link>
            <Link href="/student/lessons">Lessons confirmed</Link>
            <Link href="/student/uptake">Uptake</Link>
          </div>

          {/* Shared sign-out button */}
          <SignOutButton />
        </div>
      </nav>

      <main className="mx-auto flex-1 max-w-6xl p-4">{children}</main>
    </div>
  );
}
