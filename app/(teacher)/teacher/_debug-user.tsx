// app/(teacher)/teacher/_debug-user.tsx
import { getServerSupabase } from "@/lib/supabase/server";

export default async function DebugUser() {
  const sb = await getServerSupabase();
  const { data } = await sb.auth.getUser();
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
}
