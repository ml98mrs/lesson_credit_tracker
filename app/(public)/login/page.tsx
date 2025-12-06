// app/(public)/login/page.tsx
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/ui/Section";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type ProfileRole = "admin" | "teacher" | "student" | null;

export default function LoginPage() {
  const supabase = getBrowserSupabase();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function syncSessionToServer() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    await fetch("/api/auth/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    });
  }

  async function resolveProfileRole(): Promise<ProfileRole> {
    const { data: me } = await supabase.auth.getUser();
    const userId = me?.user?.id;

    if (!userId) return null;

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profErr || !prof) return null;

    const r = prof.role;
    if (r === "admin" || r === "teacher" || r === "student") {
      return r;
    }

    return null;
  }

  async function onSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setMsg(signInError.message);
        return;
      }

      await syncSessionToServer();

      const role = await resolveProfileRole();

      if (role === "admin") {
        router.replace("/admin/dashboard");
      } else if (role === "teacher") {
        router.replace("/teacher/dashboard");
      } else if (role === "student") {
        router.replace("/student/dashboard");
      } else {
        router.replace("/teacher/dashboard");
      }
    } catch (err: unknown) {
      console.error("Sign-in failed", err);
      if (err instanceof Error) {
        setMsg(err.message ?? "Sign-in failed. Please try again.");
      } else {
        setMsg("Sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSignOut() {
    setLoading(true);
    setMsg(null);

    try {
      await supabase.auth.signOut();

      await fetch("/api/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: null }),
      });

      router.replace("/login");
    } catch (err: unknown) {
      console.error("Sign-out failed", err);
      if (err instanceof Error) {
        setMsg(err.message ?? "Sign-out failed. Please try again.");
      } else {
        setMsg("Sign-out failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Sign in" subtitle="">
      <form onSubmit={onSignIn} className="max-w-md space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm">Email</label>
          <input
            className="border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm">Password</label>
          <input
            className="border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            disabled={loading}
            className="px-3 py-2 rounded border"
          >
            Sign out
          </button>
        </div>

        <p className="text-xs text-gray-600">
          Forgotten your password?{" "}
          <Link href="/forgot-password" className="text-blue-600 underline">
            Reset it by email
          </Link>
          .
        </p>

        {msg && <p className="mt-2 text-sm text-rose-700">{msg}</p>}
      </form>
    </Section>
  );
}
