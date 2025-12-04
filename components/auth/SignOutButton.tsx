// components/auth/SignOutButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const supabase = getBrowserSupabase();

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase signOut error:", error);
      }
    } catch (e) {
      console.error("Supabase signOut threw:", e);
    } finally {
      router.push("/login");
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-sm px-3 py-1 rounded border hover:bg-gray-100"
    >
      Sign out
    </button>
  );
}
