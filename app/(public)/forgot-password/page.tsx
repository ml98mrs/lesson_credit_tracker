// app/(public)/forgot-password/page.tsx
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Section from "@/components/ui/Section";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const supabase = getBrowserSupabase();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setError(null);

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`,
        });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMsg(
        "If an account exists for that email, we’ve sent a password reset link.",
      );
    } catch (err: unknown) {
      console.error("resetPasswordForEmail failed", err);
      if (err instanceof Error) {
        setError(err.message ?? "Failed to request password reset.");
      } else {
        setError("Failed to request password reset.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section
      title="Reset your password"
      subtitle="Enter your email and we’ll send you a password reset link."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm">Email</label>
          <input
            className="border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
        >
          {loading ? "Sending link…" : "Send reset link"}
        </button>

        {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Section>
  );
}
