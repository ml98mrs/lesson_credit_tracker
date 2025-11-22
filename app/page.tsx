"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function Login() {
  const [email, setEmail] = useState("teacher1@local.test");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = getBrowserSupabase();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setErr(error.message);

    // ⬇️ Bridge client session -> server cookies
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/auth/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    });

    router.replace("/teacher/lessons");
  }

  async function signOut() {
    await supabase.auth.signOut();
    await fetch("/auth/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "SIGNED_OUT" }),
    });
  }

  return (
    <div className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form onSubmit={signIn} className="space-y-3">
        <input className="w-full border rounded p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded p-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="px-3 py-2 rounded border" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        <button type="button" className="ml-2 px-3 py-2 rounded border" onClick={signOut}>Sign out</button>
      </form>
    </div>
  );
}
