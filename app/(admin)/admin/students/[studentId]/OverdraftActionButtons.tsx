// app/(admin)/admin/students/[studentId]/OverdraftActionButtons.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  studentId: string;
};

export default function OverdraftActionButtons({ studentId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "invoice" | "award" | "writeoff">(
    null,
  );

  async function postJSON(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let message = res.statusText;
      try {
        const json = await res.json();
        if (json?.error) message = json.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return res.json();
  }

  const handleInvoice = async () => {
    const ok = window.confirm(
      "Invoice the student for the overdraft amount and clear their negative balance? No extra credit will be created.",
    );
    if (!ok) return;

    const invoiceRef = window.prompt(
      "Enter invoice reference (required):",
      "",
    );
    if (!invoiceRef) return;

    try {
      setBusy("invoice");
      await postJSON("/api/admin/overdraft/invoice", {
        studentId,
        invoiceRef,
      });
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to invoice overdraft");
    } finally {
      setBusy(null);
    }
  };

  const handleAward = async () => {
    const ok = window.confirm(
      "Award the overdraft amount to the student (you swallow the cost) and clear their negative balance?",
    );
    if (!ok) return;

    const awardReasonCode =
      window.prompt(
        "Enter award reason code (e.g. goodwill, teacher_error):",
        "goodwill",
      ) ?? "";
    if (!awardReasonCode.trim()) return;

    try {
      setBusy("award");
      await postJSON("/api/admin/overdraft/award", {
        studentId,
        awardReasonCode,
      });
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to award overdraft");
    } finally {
      setBusy(null);
    }
  };

  const handleWriteOff = async () => {
    const ok = window.confirm(
      "Write off this overdraft (student refuses to pay / dispute) and mark it in the write-off ledger?",
    );
    if (!ok) return;

    const reasonCode =
      window.prompt(
        "Enter write-off reason code (e.g. dispute, uncollectable):",
        "uncollectable",
      ) ?? "";
    if (!reasonCode.trim()) return;

    const accountingPeriod =
      window.prompt(
        "Accounting period (YYYY, optional – leave blank for current year):",
        "",
      ) ?? "";

    try {
      setBusy("writeoff");
      await postJSON("/api/admin/overdraft/write-off", {
        studentId,
        reasonCode,
        accountingPeriod: accountingPeriod || undefined,
      });
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to write off overdraft");
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleInvoice}
        disabled={disabled}
        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
      >
        {busy === "invoice" ? "Invoicing…" : "Invoice overdraft"}
      </button>

      <button
        type="button"
        onClick={handleAward}
        disabled={disabled}
        className="rounded border border-emerald-300 px-3 py-1.5 text-xs font-medium hover:bg-emerald-50 disabled:opacity-60"
      >
        {busy === "award" ? "Awarding…" : "Award & forgive"}
      </button>

      <button
        type="button"
        onClick={handleWriteOff}
        disabled={disabled}
        className="rounded border border-rose-300 px-3 py-1.5 text-xs font-medium hover:bg-rose-50 disabled:opacity-60"
      >
        {busy === "writeoff" ? "Writing off…" : "Write off overdraft"}
      </button>
    </div>
  );
}
