// lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export function createMiddlewareSupabaseClient(req: NextRequest) {
  const res = new Response();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, _options: CookieOptions) {
          res.headers.append(
            "Set-Cookie",
            `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`,
          );
        },
        remove(name: string, _options: CookieOptions) {
          res.headers.append(
            "Set-Cookie",
            `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
          );
        },
      },
    },
  );

  return { supabase, res };
}
