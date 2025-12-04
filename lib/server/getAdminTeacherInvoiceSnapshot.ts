// lib/server/getAdminTeacherInvoiceSnapshot.ts
import { getAdminSupabase } from "@/lib/supabase/admin";
import { loadTeacherInvoiceSnapshot } from "@/lib/server/loadTeacherInvoiceSnapshot";

export async function getAdminTeacherInvoiceSnapshot(
  teacherId: string,
  invoiceId: number,
) {
  const supabase = getAdminSupabase();

  return loadTeacherInvoiceSnapshot({
    supabase,
    teacherId,
    invoiceId,
    // Admin can see generated + paid
    requirePaid: false,
  });
}
