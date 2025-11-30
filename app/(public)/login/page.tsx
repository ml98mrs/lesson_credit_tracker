'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Section from '@/components/ui/Section';
import { getBrowserSupabase } from '@/lib/supabase/browser';

const supabase = getBrowserSupabase(); // browser client, helper-based

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSignIn(e: React.FormEvent) {
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

      // 1) Bridge client session -> server cookies
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session }),
      });

      // 2) Load the user + role from profiles
      const { data: me } = await supabase.auth.getUser();
      const userId = me?.user?.id;

      let role: 'admin' | 'teacher' | 'student' | null = null;
      if (userId) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (!profErr) role = (prof?.role as any) ?? null;
      }

      // 3) Route by role (fallback to teacher dashboard if unknown)
      if (role === 'admin') {
        router.replace('/admin/dashboard');
      } else if (role === 'teacher') {
        router.replace('/teacher/dashboard');
      } else if (role === 'student') {
        router.replace('/student/dashboard');
      } else {
        router.replace('/teacher/dashboard');
      }
    } catch (err: any) {
      setMsg(err?.message ?? 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onSignOut() {
    try {
      await supabase.auth.signOut();
      await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'SIGNED_OUT' }),
      });
      setMsg('Signed out.');
    } catch (err: any) {
      setMsg(err?.message ?? 'Sign-out failed.');
    }
  }

  return (
    <Section title="Sign in" subtitle="Use the seeded accounts for now">
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="px-3 py-2 rounded border"
          >
            Sign out
          </button>
        </div>

        {msg && <p className="text-sm text-rose-700 mt-2">{msg}</p>}
      </form>
    </Section>
  );
}
