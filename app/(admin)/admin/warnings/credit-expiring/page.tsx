// app/(admin)/admin/credit/expiring/page.tsx
//
// Admin: credit expiring in next 30 days.
// Simple list, toggle between mandatory vs advisory expiry policies.

import Link from "next/link";
import { formatDateLondon } from "@/lib/formatters";
import {
  getExpiringStudentsByPolicy,
  type ExpiryPolicy,
} from "@/lib/api/admin/expiringCredit";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

function minutesToHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

export default async function ExpiringCreditPage({ searchParams }: PageProps) {
  const policyParam = searchParams?.policy;
  const policy: ExpiryPolicy =
    policyParam === "advisory" ? "advisory" : "mandatory";

  const students = await getExpiringStudentsByPolicy(policy);

  const otherPolicy: ExpiryPolicy =
    policy === "mandatory" ? "advisory" : "mandatory";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Credit expiring in next 30 days
          </h1>
          <p className="text-sm text-muted-foreground">
            Showing students with{" "}
            <span className="font-medium">{policy}</span> expiry policy.
          </p>
        </div>

        {/* Simple toggle via query param */}
        <div className="inline-flex rounded-full border p-1 text-xs">
          <Link
            href="?policy=mandatory"
            className={`rounded-full px-3 py-1 ${
              policy === "mandatory" ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            Mandatory
          </Link>
          <Link
            href="?policy=advisory"
            className={`rounded-full px-3 py-1 ${
              policy === "advisory" ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            Advisory
          </Link>
        </div>
      </header>

      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {policy} credit lots expiring in the next 30 days.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Student</th>
                <th className="px-3 py-2 text-right font-medium">Lots</th>
                <th className="px-3 py-2 text-right font-medium">
                  Total expiring (h)
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  Earliest expiry
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    {/* For now we show ID; once you confirm name field we can join + show name instead */}
                    <span className="font-mono text-xs">{s.studentId}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{s.lotCount}</td>
                  <td className="px-3 py-2 text-right">
                    {minutesToHours(s.totalMinutes)}
                  </td>
                  <td className="px-3 py-2">
                    {s.earliestExpiryDate
                      ? formatDateLondon(s.earliestExpiryDate)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/students/summary?studentId=${s.studentId}`}
                      className="text-xs font-medium underline-offset-2 hover:underline"
                    >
                      Student 360
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tip: switch to <span className="font-medium">{otherPolicy}</span> to
        review softer “advisory” expiries separately from hard mandatory ones.
      </p>
    </div>
  );
}
