// app/(admin)/admin/credit-invoices/page.tsx

import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import Section from "@/components/ui/Section";
import { formatDateTimeLondon, formatMinutesAsHours } from "@/lib/formatters";
import type { ProfilesEmbed } from "@/lib/types/profiles";
import { readProfileFullName } from "@/lib/types/profiles";
import {
  type Delivery,
  type Tier,
  type LengthCat,
  type ExpiryPolicy,
  type CreditLotState,
} from "@/lib/enums";

type CreditInvoiceLot = {
  id: string;
  student_id: string;
  source_type: "invoice" | "award" | "overdraft" | "adjustment";
  external_ref: string | null;
  minutes_granted: number;
  delivery_restriction: Delivery | null;
  tier_restriction: Tier | null;
  length_restriction: LengthCat | null;
  expiry_policy: ExpiryPolicy;
  expiry_date: string | null;
  state: CreditLotState;
  created_at: string | null;
  amount_pennies: number | null;
};

type RemainingRow = {
  credit_lot_id: string;
  minutes_remaining: number | null;
};

type StudentRow = {
  id: string;
  profiles: ProfilesEmbed;
};

type InvoiceRow = {
  lot: CreditInvoiceLot;
  studentName: string;
  remainingMinutes: number | null;
};

// Small helpers for display
const formatDeliveryRestriction = (d: Delivery | null): string => {
  if (!d) return "Hybrid / unrestricted";
  if (d === "online") return "Online only";
  if (d === "f2f") return "Face to face only";
  return d;
};

const formatTierRestriction = (t: Tier | null): string => {
  if (!t) return "Unrestricted";
  switch (t) {
    case "basic":
      return "Basic only";
    case "premium":
      return "Premium only";
    case "elite":
      return "Elite only";
    default:
      return t;
  }
};

const formatLengthRestriction = (l: LengthCat | null): string => {
  if (!l || l === "none") return "No length restriction";
  if (l === "60") return "60 min";
  if (l === "90") return "90 min";
  if (l === "120") return "120 min";
  return l;
};

const formatPolicyBadge = (policy: ExpiryPolicy): string => {
  if (policy === "none") return "none (no expiry)";
  if (policy === "advisory") return "advisory (soft)";
  return "mandatory (enforced)";
};

export default async function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const sb = getAdminSupabase();
  const sp = searchParams ?? {};

  const getParam = (key: string): string =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";

  const deliveryFilter = getParam("delivery"); // "", "online", "f2f", "unrestricted"
  const tierFilter = getParam("tier"); // "", "basic","premium","elite","unrestricted"
  const lengthFilter = getParam("length"); // "", "60","90","120","none","unrestricted"
  const stateFilter = getParam("state"); // "", "open","closed","expired","cancelled"
  const policyFilter = getParam("policy"); // "", "none","advisory","mandatory"
  const studentFilter = getParam("student"); // free text
  const extRefFilter = getParam("extRef"); // free text
  const sortRemaining = getParam("sortRemaining"); // "", "asc", "desc"
  const sortAmount = getParam("sortAmount"); // "", "asc", "desc"

  //
  // 1) Load recent invoice-backed credit lots
  //
  let lots: CreditInvoiceLot[] = [];
  let errorMsg: string | null = null;

  try {
    const { data, error } = await sb
      .from("credit_lots")
      .select(
        [
          "id",
          "student_id",
          "source_type",
          "external_ref",
          "minutes_granted",
          "delivery_restriction",
          "tier_restriction",
          "length_restriction",
          "expiry_policy",
          "expiry_date",
          "state",
          "created_at",
          "amount_pennies",
        ].join(","),
      )
      .eq("source_type", "invoice")
      .not("external_ref", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<CreditInvoiceLot[]>();

    if (error) {
      errorMsg = error.message;
    } else {
      lots = data ?? [];
    }
  } catch (e: any) {
    errorMsg = e?.message ?? "Unknown error while loading credit invoices";
  }

  //
  // 2) Lookup remaining minutes for these lots (optional)
  //
  const remainingByLotId = new Map<string, number | null>();

  if (lots.length > 0) {
    try {
      const lotIds = lots.map((l) => l.id);
      const { data, error } = await sb
        .from("v_credit_lot_remaining")
        .select("credit_lot_id, minutes_remaining")
        .in("credit_lot_id", lotIds);

      if (!error && Array.isArray(data)) {
        (data as RemainingRow[]).forEach((row) => {
          remainingByLotId.set(row.credit_lot_id, row.minutes_remaining);
        });
      }
    } catch {
      // ignore; we just won't show remaining
    }
  }

  //
  // 3) Lookup student names via students → profiles(full_name)
  //
  const nameByStudentId = new Map<string, string>();

  if (lots.length > 0) {
    try {
      const studentIds = Array.from(
        new Set(lots.map((l) => l.student_id)),
      );
      const { data, error } = await sb
        .from("students")
        .select("id, profiles(full_name)")
        .in("id", studentIds);

      if (!error && Array.isArray(data)) {
        (data as StudentRow[]).forEach((row) => {
          const name = readProfileFullName(row.profiles);
          if (name) {
            nameByStudentId.set(row.id, name);
          }
        });
      }
    } catch {
      // ignore; we'll fall back to student_id
    }
  }

  // Enrich lots into rows (with studentName + remainingMinutes)
  let rows: InvoiceRow[] = lots.map((lot) => ({
    lot,
    studentName:
      nameByStudentId.get(lot.student_id) ?? lot.student_id,
    remainingMinutes: remainingByLotId.get(lot.id) ?? null,
  }));

  // ---- 4) Apply filters ---------------------------------------------------

  const normalize = (s: string) => s.toLowerCase();

  if (deliveryFilter) {
    rows = rows.filter(({ lot }) => {
      if (deliveryFilter === "unrestricted") {
        return lot.delivery_restriction === null;
      }
      return lot.delivery_restriction === (deliveryFilter as Delivery);
    });
  }

  if (tierFilter) {
    rows = rows.filter(({ lot }) => {
      if (tierFilter === "unrestricted") {
        return lot.tier_restriction === null;
      }
      return lot.tier_restriction === (tierFilter as Tier);
    });
  }

  if (lengthFilter) {
    rows = rows.filter(({ lot }) => {
      if (lengthFilter === "unrestricted") {
        return lot.length_restriction === null;
      }
      return lot.length_restriction === (lengthFilter as LengthCat);
    });
  }

  if (stateFilter) {
    rows = rows.filter(({ lot }) => lot.state === stateFilter);
  }

  if (policyFilter) {
    rows = rows.filter(
      ({ lot }) => lot.expiry_policy === policyFilter,
    );
  }

  if (studentFilter.trim()) {
    const sf = normalize(studentFilter.trim());
    rows = rows.filter(({ studentName, lot }) => {
      const label = studentName || lot.student_id;
      return normalize(label).includes(sf);
    });
  }

  if (extRefFilter.trim()) {
    const ef = normalize(extRefFilter.trim());
    rows = rows.filter(({ lot }) => {
      const ref = lot.external_ref ?? lot.id;
      return normalize(ref).includes(ef);
    });
  }

  // ---- 5) Apply sorting ---------------------------------------------------

  rows = [...rows]; // shallow copy before sort

  if (sortRemaining === "asc" || sortRemaining === "desc") {
    rows.sort((a, b) => {
      const aVal = a.remainingMinutes ?? Number.NEGATIVE_INFINITY;
      const bVal = b.remainingMinutes ?? Number.NEGATIVE_INFINITY;
      if (aVal === bVal) return 0;
      const cmp = aVal < bVal ? -1 : 1;
      return sortRemaining === "asc" ? cmp : -cmp;
    });
  }

  if (sortAmount === "asc" || sortAmount === "desc") {
    rows.sort((a, b) => {
      const aVal =
        typeof a.lot.amount_pennies === "number"
          ? a.lot.amount_pennies
          : -1;
      const bVal =
        typeof b.lot.amount_pennies === "number"
          ? b.lot.amount_pennies
          : -1;
      if (aVal === bVal) return 0;
      const cmp = aVal < bVal ? -1 : 1;
      return sortAmount === "asc" ? cmp : -cmp;
    });
  }

  return (
    <Section
      title="Credit invoices"
      subtitle="Invoice-backed credit lots (latest 50). Filter by restrictions, state, policy, and student."
    >
      {errorMsg ? (
        <p className="text-sm text-rose-700">
          Error loading credit invoices: {errorMsg}
        </p>
      ) : lots.length === 0 ? (
        <p className="text-sm text-gray-700">
          No invoice-backed credit yet.
        </p>
      ) : (
        <>
          {/* Filters */}
          <form
            className="mb-4 flex flex-wrap items-end gap-3 text-xs"
            method="get"
          >
            {/* Text filters */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">
                Student
              </label>
              <input
                name="student"
                defaultValue={studentFilter}
                placeholder="Search by student name…"
                className="h-7 rounded border px-2 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">
                Invoice / external ref
              </label>
              <input
                name="extRef"
                defaultValue={extRefFilter}
                placeholder="Search by invoice #…"
                className="h-7 rounded border px-2 text-xs"
              />
            </div>

            {/* Dropdown filters */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">
                Delivery restriction
              </label>
              <select
                name="delivery"
                defaultValue={deliveryFilter}
                className="h-7 rounded border px-2 text-xs"
              >
                <option value="">All</option>
                <option value="online">Online only</option>
                <option value="f2f">Face to face only</option>
                <option value="unrestricted">
                  Hybrid / unrestricted
                </option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">
                Tier restriction
              </label>
              <select
                name="tier"
                defaultValue={tierFilter}
                className="h-7 rounded border px-2 text-xs"
              >
                <option value="">All</option>
                <option value="basic">Basic only</option>
                <option value="premium">Premium only</option>
                <option value="elite">Elite only</option>
                <option value="unrestricted">Unrestricted</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">
                Length restriction
              </label>
              <select
                name="length"
                defaultValue={lengthFilter}
                className="h-7 rounded border px-2 text-xs"
              >
                <option value="">All</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
                <option value="none">No length restriction</option>
                <option value="unrestricted">Legacy / null</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">State</label>
              <select
                name="state"
                defaultValue={stateFilter}
                className="h-7 rounded border px-2 text-xs"
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">
                Expiry policy
              </label>
              <select
                name="policy"
                defaultValue={policyFilter}
                className="h-7 rounded border px-2 text-xs"
              >
                <option value="">All</option>
                <option value="none">None (no expiry)</option>
                <option value="advisory">Advisory</option>
                <option value="mandatory">Mandatory</option>
              </select>
            </div>

            {/* Sort controls */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">
                Remaining hours
              </label>
              <select
                name="sortRemaining"
                defaultValue={sortRemaining}
                className="h-7 rounded border px-2 text-xs"
              >
                <option value="">No sort</option>
                <option value="desc">High → low</option>
                <option value="asc">Low → high</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">
                Amount
              </label>
              <select
                name="sortAmount"
                defaultValue={sortAmount}
                className="h-7 rounded border px-2 text-xs"
              >
                <option value="">No sort</option>
                <option value="desc">High → low</option>
                <option value="asc">Low → high</option>
              </select>
            </div>

            <button
              type="submit"
              className="h-7 rounded border px-3 text-xs font-medium"
            >
              Apply
            </button>
          </form>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Invoice #</th>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Hours granted</th>
                  <th className="py-2 pr-4">Remaining (h)</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Delivery restriction</th>
                  <th className="py-2 pr-4">Tier restriction</th>
                  <th className="py-2 pr-4">Length restriction</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Policy</th>
                  <th className="py-2 pr-4">Expiry</th>
                  <th className="py-2 pr-4">View</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ lot, studentName, remainingMinutes }) => {
                  const amount =
                    typeof lot.amount_pennies === "number"
                      ? `£${(lot.amount_pennies / 100).toFixed(2)}`
                      : "—";

                  const invoiceRef = lot.external_ref ?? lot.id;

                  const policyBadge = formatPolicyBadge(
                    lot.expiry_policy,
                  );

                  return (
                    <tr key={lot.id} className="border-b align-top">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {lot.external_ref ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/admin/students/${lot.student_id}`}
                          className="underline"
                        >
                          {studentName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        {formatMinutesAsHours(lot.minutes_granted)} h
                      </td>
                      <td className="py-2 pr-4">
                        {typeof remainingMinutes === "number"
                          ? `${formatMinutesAsHours(
                              remainingMinutes,
                            )} h`
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">{amount}</td>
                      <td className="py-2 pr-4">
                        {formatDeliveryRestriction(
                          lot.delivery_restriction,
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {formatTierRestriction(lot.tier_restriction)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatLengthRestriction(
                          lot.length_restriction,
                        )}
                      </td>
                      <td className="py-2 pr-4">{lot.state}</td>
                      <td className="py-2 pr-4">{policyBadge}</td>
                      <td className="py-2 pr-4">
                        {lot.expiry_date
                          ? formatDateTimeLondon(lot.expiry_date)
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/admin/credit-invoices/${encodeURIComponent(
                            invoiceRef,
                          )}`}
                          className="underline"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}
