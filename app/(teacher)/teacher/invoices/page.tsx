import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatPenniesAsPounds } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type InvoiceSummaryStatus = "not_generated" | "generated" | "paid";

type InvoiceSummaryRow = {
  month_start: string; // 'YYYY-MM-DD'
  lesson_gross_pennies: number | null;
  expenses_pennies: number | null;
  total_pennies: number | null;
  status: InvoiceSummaryStatus;
};

type TeacherInvoiceRow = {
  id: string;
  month_start: string; // 'YYYY-MM-DD'
  invoice_ref: string | null;
  status: "generated" | "paid";
};

// For teachers, treat the "invoice month" as the previous calendar month.
// Example: on 8th December we are preparing invoices for November.
function getInvoiceMonthKey(): string {
  const now = new Date();
  const invoiceMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return invoiceMonthStart.toISOString().slice(0, 10); // 'YYYY-MM-01'
}

function formatMonthLabel(monthStart: string): string {
  const d = new Date(`${monthStart}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function StatusPill({ status }: { status: InvoiceSummaryStatus }) {
  const common =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  if (status === "paid") {
    return <span className={`${common} bg-green-100 text-green-800`}>Paid</span>;
  }
  if (status === "generated") {
    return (
      <span className={`${common} bg-amber-100 text-amber-800`}>Generated</span>
    );
  }
  return (
    <span className={`${common} bg-gray-100 text-gray-800`}>Not generated</span>
  );
}

export default async function TeacherInvoicesIndex() {
  const supabase = await getServerSupabase();

  const [{ data: summaries, error: summaryError }, { data: invoices, error: invoiceError }] =
    await Promise.all([
      supabase
        .from("v_teacher_invoice_summary")
        .select(
          "month_start, lesson_gross_pennies, expenses_pennies, total_pennies, status",
        )
        .order("month_start", { ascending: false })
        .limit(12),
      supabase
        .from("teacher_invoices")
        .select("id, month_start, invoice_ref, status")
        .order("month_start", { ascending: false })
        .limit(12),
    ]);

  if (summaryError || invoiceError) {
    return (
      <Section
        title="My invoices"
        subtitle="Monthly earnings and expenses summary."
      >
        <p className="mb-4 text-sm text-gray-600">
          Sorry — we couldn’t load your invoice data right now.
        </p>
        <Link
          href="/teacher/invoices/current-month"
          className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Go to invoice month snapshot
        </Link>
      </Section>
    );
  }

  const summaryRows: InvoiceSummaryRow[] = summaries ?? [];
  const invoiceRows: TeacherInvoiceRow[] = invoices ?? [];

  const invoiceByMonth = new Map<string, TeacherInvoiceRow>();
  for (const inv of invoiceRows) {
    invoiceByMonth.set(inv.month_start, inv);
  }

  // Latest invoice month = previous calendar month
  const invoiceMonthKey = getInvoiceMonthKey();
  const invoiceMonthLabel = formatMonthLabel(invoiceMonthKey);

  const invoiceSummary = summaryRows.find(
    (row) => row.month_start === invoiceMonthKey,
  );

  // History = all other months (older and, if present, the live current month)
  const historyRows = summaryRows.filter(
    (row) => row.month_start !== invoiceMonthKey,
  );

  const invoiceLessonGross = invoiceSummary?.lesson_gross_pennies ?? 0;
  const invoiceExpenses = invoiceSummary?.expenses_pennies ?? 0;
  const invoiceTotal = invoiceSummary?.total_pennies ?? 0;

  return (
    <Section
      title="My invoices"
      subtitle="Monthly snapshot of lessons, expenses, and what’s owed to you."
    >
      <div className="space-y-8">
        {/* Latest invoice-month callout */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Latest invoice month
              </h2>
              <p className="mt-1 text-xs text-gray-600">
                This shows your confirmed lessons and approved expenses for{" "}
                <span className="font-medium">{invoiceMonthLabel}</span>, which
                is the month your next invoice is based on.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <StatusPill status={invoiceSummary?.status ?? "not_generated"} />
              <div className="text-right text-xs text-gray-600">
                <div>
                  Total:{" "}
                  <span className="font-semibold">
                    {formatPenniesAsPounds(invoiceTotal)}
                  </span>
                </div>
                <div>
                  Lessons: {formatPenniesAsPounds(invoiceLessonGross)} ·
                  Expenses: {formatPenniesAsPounds(invoiceExpenses)}
                </div>
              </div>
              <Link
                href="/teacher/invoices/current-month"
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
              >
                View invoice month breakdown
              </Link>
            </div>
          </div>
        </div>

        {/* History table */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Invoice history
          </h2>
          <p className="mb-4 text-xs text-gray-600">
            Once an invoice is generated, it will appear here with a link to the
            detailed invoice page. Months without a generated invoice still show
            your combined teaching and approved expenses.
          </p>

          {historyRows.length === 0 ? (
            <p className="text-xs text-gray-500">
              No other months to show yet. You’ll see previous months here once
              invoices have been generated.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Month
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Lesson earnings
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Expenses
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Total
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {historyRows.map((row) => {
                    const inv = invoiceByMonth.get(row.month_start);
                    const lessonGross = row.lesson_gross_pennies ?? 0;
                    const expenses = row.expenses_pennies ?? 0;
                    const total = row.total_pennies ?? 0;

                    return (
                      <tr key={row.month_start}>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {formatMonthLabel(row.month_start)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-gray-900">
                          {formatPenniesAsPounds(lessonGross)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-gray-900">
                          {formatPenniesAsPounds(expenses)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-gray-900">
                          {formatPenniesAsPounds(total)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {inv && (row.status === "generated" || row.status === "paid") ? (
                            <Link
                              href={`/teacher/invoices/${inv.id}`}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              Open invoice
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
