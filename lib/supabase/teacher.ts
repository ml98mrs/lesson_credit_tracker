// lib/supabase/teacher.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export async function getTeacherSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, _options: CookieOptions) {
          cookieStore.set(name, value);
        },
        remove(name: string, _options: CookieOptions) {
          cookieStore.delete(name);
        },
      },
    },
  );
}
