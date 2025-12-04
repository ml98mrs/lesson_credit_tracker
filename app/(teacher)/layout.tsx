// app/(teacher)/teacher/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import SignOutButton from "@/components/auth/SignOutButton";

const tabs = [
  { href: "/teacher/dashboard", label: "Teacher Dashboard" },
  { href: "/teacher/lessons/new", label: "Log a lesson" },
  { href: "/teacher/students", label: "Students" },
  { href: "/teacher/expenses", label: "Expenses" },
  { href: "/teacher/invoices", label: "Invoices" },
];

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <nav className="mb-6 flex items-center gap-3 border-b pb-3">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-1.5 rounded-lg hover:bg-gray-100",
              pathname.startsWith(t.href) && "bg-gray-100 font-semibold",
            )}
          >
            {t.label}
          </Link>
        ))}

        {/* Shared sign-out */}
        <div className="ml-auto">
          <SignOutButton />
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
