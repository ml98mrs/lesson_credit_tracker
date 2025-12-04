// lib/server/getTeacherPortalInvoiceSnapshot.ts
import { getTeacherSupabase } from "@/lib/supabase/teacher";
import { loadTeacherInvoiceSnapshot } from "@/lib/server/loadTeacherInvoiceSnapshot";

/**
 * Teacher-portal wrapper.
 * - Uses the teacher session client
 * - Lets loadTeacherInvoiceSnapshot enforce teacher ownership
 * - Optionally lock to `requirePaid: true` if you want.
 */
export async function getTeacherPortalInvoiceSnapshot(
  teacherId: string,
  invoiceId: number,
  opts?: { requirePaid?: boolean },
) {
  const supabase = await getTeacherSupabase();

  return loadTeacherInvoiceSnapshot({
    supabase,
    teacherId,
    invoiceId,
    requirePaid: opts?.requirePaid ?? false,
  });
}
