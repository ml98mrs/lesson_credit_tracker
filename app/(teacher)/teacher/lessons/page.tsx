// app/(teacher)/teacher/lessons/page.tsx

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function TeacherLessonsRedirectPage() {
  const sb = await getServerSupabase();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user) {
    return <p>Please sign in.</p>;
  }

  // For authenticated teachers, this page is now just a redirect
  redirect("/teacher/lessons/new");
}
