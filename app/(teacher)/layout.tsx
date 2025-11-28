// app/(teacher)/teacher/layout.tsx
"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/browser";

function SignOutButton() {
  const router = useRouter();
  const sb = getBrowserSupabase();

  async function handleSignOut() {
    try {
      const { error } = await sb.auth.signOut();
      if (error) {
        console.error("Supabase signOut error (teacher):", error);
      }
    } catch (e) {
      console.error("Supabase signOut threw (teacher):", e);
    }

    try {
      // Always tell the server to clear cookies, even if signOut errored.
      await fetch("/api/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "SIGNED_OUT" }),
      });
    } catch (e) {
      console.error("POST /api/auth/callback SIGNED_OUT failed:", e);
    }

    router.replace("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-600 hover:text-black ml-auto"
    >
      Sign out
    </button>
  );
}


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
      <nav className="flex items-center gap-3 mb-6 border-b pb-3">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-1.5 rounded-lg hover:bg-gray-100",
              pathname.startsWith(t.href) && "font-semibold bg-gray-100"
            )}
          >
            {t.label}
          </Link>
        ))}
        <SignOutButton />
      </nav>
      <main>{children}</main>
    </div>
  );
}
