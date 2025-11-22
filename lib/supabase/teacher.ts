// lib/supabase/teacher.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function getTeacherSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, _options: CookieOptions) {
          // In your Next version, cookies().set only accepts (name, value)
          cookieStore.set(name, value);
        },
        remove(name: string, _options: CookieOptions) {
          // Same here: only (name)
          cookieStore.delete(name);
        },
      },
    }
  );
}
