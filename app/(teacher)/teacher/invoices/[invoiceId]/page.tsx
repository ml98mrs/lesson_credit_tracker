import { getServerSupabase } from "@/lib/supabase/server";
import { formatPenniesAsPounds, formatMinutesAsHours } from "@/lib/formatters";
import { formatDateLondon } from "@/lib/formatters";
import Section from "@/components/ui/Section";

export const dynamic = "force-dynamic";

interface InvoiceRow {
  id: string;
  month_start: string;
  teacher_id: string;
  status: "generated" | "paid";
}

interface LessonLine {
  lesson_id: string;
  student_id: string;
  student_name: string;
  start_at: string;
  duration_min: number;
  delivery: string;
  gross_pennies: number;
  is_snc: boolean;
  snc_mode: string;
}

interface ExpenseRow {
  id: string;
  incurred_at: string;
  amount_pennies: number;
  category: string;
  description: string | null;
  status: "approved" | "pending" | "rejected";
  student_id: string | null;
}

export default async function TeacherInvoiceDetailPage(props: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await props.params;
  const supabase = await getServerSupabase();

  // -----------------------------------------------------------
  // 0) Map logged-in user -> teacher_id
  // -----------------------------------------------------------
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;

  if (!user) {
    return (
      <Section title="Invoice" subtitle="">
        <p className="text-sm text-gray-600">Please sign in.</p>
      </Section>
    );
  }

  const { data: t, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (teacherError || !t?.id) {
    return (
      <Section title="Invoice" subtitle="">
        <p className="text-sm text-red-600">
          Teacher record not found for this user.
        </p>
      </Section>
    );
  }

  const teacherId = t.id as string;

  // -----------------------------------------------------------
  // 1) Load invoice record, verifying ownership
  // -----------------------------------------------------------
  const { data: invoice, error: invErr } = await supabase
    .from("teacher_invoices")
    .select("id, teacher_id, month_start, status")
    .eq("id", invoiceId)
    .eq("teacher_id", teacherId)
    .maybeSingle<InvoiceRow>();

  if (invErr || !invoice) {
    return (
      <Section title="Invoice" subtitle="">
        <p className="text-sm text-red-600">
          Invoice not found or not accessible.
        </p>
      </Section>
    );
  }

  const monthStart = invoice.month_start; // YYYY-MM-01

  // -----------------------------------------------------------
  // 2) Load lesson earnings for this teacher + month
  // -----------------------------------------------------------
  const { data: lessonLines, error: lineErr } = await supabase
    .from("v_teacher_lesson_earnings_detail")
    .select(
      "lesson_id, student_id, student_name, start_at, duration_min, delivery, gross_pennies, is_snc, snc_mode"
    )
    .eq("teacher_id", teacherId)
    .eq("month_start", monthStart)
    .order("start_at", { ascending: true });

  // -----------------------------------------------------------
  // 3) Load approved expenses for this month
  // -----------------------------------------------------------
  const { data: expenses, error: expErr } = await supabase
    .from("teacher_expenses")
    .select(
      "id, incurred_at, amount_pennies, category, description, status, student_id"
    )
    .eq("teacher_id", teacherId)
    .eq("status", "approved")
    .gte("incurred_at", monthStart)
    .lt("incurred_at", monthStart.replace(/-01$/, "-32")); // end of month

  // -----------------------------------------------------------
  // 4) Compute totals
  // -----------------------------------------------------------
  const lessonTotal =
    (lessonLines ?? []).reduce(
      (sum, l) => sum + (l.gross_pennies ?? 0),
      0
    ) ?? 0;

  const expenseTotal =
    (expenses ?? []).reduce(
      (sum, e) => sum + (e.amount_pennies ?? 0),
      0
    ) ?? 0;

  const invoiceTotal = lessonTotal + expenseTotal;

  // -----------------------------------------------------------
  // 5) Render
  // -----------------------------------------------------------
  return (
    <Section
      title="Invoice details"
      subtitle={`Month starting ${formatDateLondon(monthStart)}`}
    >
      <div className="mb-6">
        <p className="text-sm text-gray-700">
          <strong>Status:</strong>{" "}
          {invoice.status === "paid" ? "Paid" : "Not yet paid"}
        </p>
        <p className="text-sm text-gray-700">
          <strong>Total:</strong>{" "}
          {formatPenniesAsPounds(invoiceTotal)}
        </p>
      </div>

      {/* Lessons */}
      <h3 className="font-semibold text-lg mb-2">Lesson earnings</h3>
      {(!lessonLines || lessonLines.length === 0) && (
        <p className="text-sm text-gray-600 mb-4">
          No lessons found for this month.
        </p>
      )}
      {lessonLines && lessonLines.length > 0 && (
        <table className="text-sm w-full mb-8 border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-left">Date</th>
              <th className="py-1 text-left">Student</th>
              <th className="py-1 text-left">Duration</th>
              <th className="py-1 text-left">Delivery</th>
              <th className="py-1 text-left">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lessonLines.map((l) => (
              <tr key={l.lesson_id} className="border-b">
                <td className="py-1">{formatDateLondon(l.start_at)}</td>
                <td className="py-1">{l.student_name}</td>
                <td className="py-1">
                  {formatMinutesAsHours(l.duration_min)}h
                </td>
                <td className="py-1 uppercase">{l.delivery}</td>
                <td className="py-1">{formatPenniesAsPounds(l.gross_pennies)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Expenses */}
      <h3 className="font-semibold text-lg mb-2">Approved expenses</h3>
      {(!expenses || expenses.length === 0) && (
        <p className="text-sm text-gray-600 mb-4">
          No approved expenses for this month.
        </p>
      )}
      {expenses && expenses.length > 0 && (
        <table className="text-sm w-full mb-6 border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-left">Date</th>
              <th className="py-1 text-left">Category</th>
              <th className="py-1 text-left">Description</th>
              <th className="py-1 text-left">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="py-1">{formatDateLondon(e.incurred_at)}</td>
                <td className="py-1 capitalize">{e.category}</td>
                <td className="py-1">{e.description ?? "—"}</td>
                <td className="py-1">
                  {formatPenniesAsPounds(e.amount_pennies)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}
