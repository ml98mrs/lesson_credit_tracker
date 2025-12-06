// app/(public)/reset-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Section from "@/components/ui/Section";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type ProfileRole = "admin" | "teacher" | "student" | null;

export default function ResetPasswordPage() {
  const supabase = getBrowserSupabase();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function syncSessionToServer(session?: Session | null) {
    let payloadSession: Session | null = null;

    if (session !== undefined) {
      payloadSession = session;
    } else {
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      payloadSession = current;
    }

    await fetch("/api/auth/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: payloadSession }),
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

  async function routeByRole() {
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
  }

  // 1) On mount, consume the recovery tokens in the URL and create a session
  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;

      setLoading(true);
      setMsg(null);

      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash;

        if (hash && hash.includes("access_token")) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const type = hashParams.get("type"); // should be "recovery"

          if (accessToken && refreshToken && type === "recovery") {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error("setSession (recovery) error", error);
              setMsg(error.message ?? "Invalid or expired recovery link.");
              setLoading(false);
              return;
            }

            if (data.session) {
              await syncSessionToServer(data.session);
              // Clean the URL (remove hash)
              const cleanUrl =
                url.pathname + (url.search ? url.search : "");
              window.history.replaceState({}, "", cleanUrl);
              setSessionReady(true);
              setLoading(false);
              return;
            }
          }
        }

        // Fallback: if user somehow already has a session, still allow changing password
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          await syncSessionToServer(session);
          setSessionReady(true);
        } else {
          setMsg(
            "Password reset link is invalid or has expired. Please request a new one.",
          );
        }
      } catch (err) {
        console.error("Error handling recovery link", err);
        if (err instanceof Error) {
          setMsg(err.message ?? "Failed to handle password reset link.");
        } else {
          setMsg("Failed to handle password reset link.");
        }
      } finally {
        setLoading(false);
      }
    })();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Submit new password
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    if (!sessionReady) {
      setMsg("Your session is not ready. Please use the link from your email again.");
      return;
    }

    if (!password || password.length < 8) {
      setMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error("updateUser (password) error", error);
        setMsg(error.message ?? "Failed to update password.");
        setLoading(false);
        return;
      }

      setMsg("Password updated. Redirecting…");
      await routeByRole();
    } catch (err) {
      console.error("Password reset failed", err);
      if (err instanceof Error) {
        setMsg(err.message ?? "Password reset failed. Please try again.");
      } else {
        setMsg("Password reset failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }


  return (
    <Section
      title="Reset your password"
      subtitle="Choose a new password for your account."
    >
      {loading && !sessionReady ? (
        <p className="text-sm text-gray-600">Checking your reset link…</p>
      ) : !sessionReady ? (
        <p className="text-sm text-rose-700">
          {msg ??
            "Password reset link is invalid or has expired. Please request a new one."}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="max-w-md space-y-3">
          {msg && (
            <p className="text-sm text-rose-700">
              {msg}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm">New password</label>
            <input
              className="border rounded px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">Confirm new password</label>
            <input
              className="border rounded px-3 py-2"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </Section>
  );
}
