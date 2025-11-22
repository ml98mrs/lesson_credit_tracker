"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdminSignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login"); // or "/" if that’s your public entry point
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
