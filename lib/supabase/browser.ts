// lib/supabase/browser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

type BrowserSupabaseClient = ReturnType<
  typeof createBrowserClient<Database>
>;

let browserClient: BrowserSupabaseClient | null = null;

export function getBrowserSupabase(): BrowserSupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      // Fail fast with a clearer error if env is misconfigured
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );
    }

    browserClient = createBrowserClient<Database>(url, anonKey);
  }

  return browserClient;
}
