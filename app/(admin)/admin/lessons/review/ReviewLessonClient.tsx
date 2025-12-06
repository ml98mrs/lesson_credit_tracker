"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import Section from "@/components/ui/Section";
import HazardBadge from "@/components/badges/HazardBadge";
import LessonHazards from "@/components/admin/LessonHazards";
import SNCInfoPanel, { SncStats } from "@/components/admin/SNCInfoPanel";
import { TierBadge } from "@/components/admin/TierBadge";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { StatusPill } from "@/components/ui/StatusPill";

import {
  formatDateTimeLondon,
  formatMinutesAsHours,
} from "@/lib/formatters";
import { formatLotLabel } from "@/lib/creditLots/labels";
import type { CreditLotSource } from "@/lib/creditLots/types";
import type {
  Delivery,
  DeliveryRestriction,
  LengthCat,
  LessonState,
  Tier,
  SncMode,
} from "@/lib/enums";
import { DELIVERY } from "@/lib/enums";
import {
  LENGTH_RESTRICTIONS,
  formatLengthRestrictionLabel,
} from "@/lib/domain/lengths";
import {
  formatDeliveryUiLabel,
  formatDeliveryRestrictionLabel,
} from "@/lib/domain/delivery";

type Lesson = {
  id: string;
  student_id: string;
  teacher_id: string;
  occurred_at: string;
  duration_min: number;
  delivery: Delivery;
  length_cat: LengthCat;
  state: LessonState;
  is_snc: boolean;
  snc_mode: SncMode;
  notes: string | null;
};

type LotRow = {
  credit_lot_id: string;
  student_id: string;
  source_type: CreditLotSource;
  award_reason_code: string | null;
  external_ref: string | null;
  minutes_granted: number;
  minutes_allocated: number;
  minutes_remaining: number;
  delivery_restriction: DeliveryRestriction;
  tier_restriction: Tier | null;
  length_restriction: LengthCat | null;
  start_date: string;
  expiry_date: string | null;
  state: "open" | "closed" | "expired" | "cancelled";
};

type PreviewStep = {
  creditLotId: string | null;
  sourceType: CreditLotSource | "overdraft";
  deliveryRestriction: DeliveryRestriction;
  lengthRestriction: LengthCat | null;
  tierRestriction: Tier | null;
  fromRemaining: number;
  allocate: number;
  toRemaining: number;
  counterDelivery: boolean;
  lengthViolation: boolean;
  overdraft: boolean;
};

type PreviewPlan = {
  lessonId: string;
  studentId: string;
  teacherId: string;
  isSnc: boolean;
  isFreeSnc: boolean;
  sncMode: SncMode;
  tier: Tier | null;
  plan: PreviewStep[];
  counterDelivery: boolean;
  lengthViolation: boolean;
  negativeBalance: boolean;
  hasMandatoryExpiredLots?: boolean;
};

export default function ReviewLessonClient() {
  const sp = useSearchParams();

  // Normalise param names case-insensitively: lessonId / id
  let lessonId = "";
  for (const [key, value] of sp.entries()) {
    if (!value) continue;
    const k = key.toLowerCase();
    if (k === "lessonid" || k === "id") {
      lessonId = value;
      break;
    }
  }
  if (!lessonId) {
    lessonId =
      sp.get("lessonId") || sp.get("lessonid") || sp.get("id") || "";
  }

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [editDuration, setEditDuration] = useState<number | "">("");
  const [editDelivery, setEditDelivery] = useState<Delivery>("online");
  const [editLength, setEditLength] = useState<LengthCat>("none");

  const [studentName, setStudentName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [lots, setLots] = useState<LotRow[]>([]);
  const [sncStats, setSncStats] = useState<SncStats | null>(null);
  const [studentTier, setStudentTier] = useState<Tier | null>(null);

  // Confirm state
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  // Admin override controls
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // DB planner preview
  const [preview, setPreview] = useState<PreviewPlan | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  // --- Helpers ----------------------------------------------------------

  async function fetchPreview(currentOverride: boolean) {
    if (!lessonId) {
      setPreview(null);
      setPreviewErr("Missing lessonId for preview");
      return;
    }

    setPreviewLoading(true);
    setPreviewErr(null);

    try {
      const res = await fetch("/api/admin/lessons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          override: currentOverride,
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || "Failed to load preview");
      }

      setPreview(j as PreviewPlan);
    } catch (e: unknown) {
      setPreview(null);
      if (e instanceof Error) {
        setPreviewErr(e.message);
      } else {
        setPreviewErr("Unknown error while generating preview");
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  // --- Initial load -----------------------------------------------------

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);

    if (!lessonId) {
      setErr("Missing ?lessonId");
      setLoading(false);
      return;
    }

    fetch(
      `/api/admin/lessons/review?lessonId=${encodeURIComponent(lessonId)}`,
    )
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || r.statusText);
        }
        return r.json();
      })
      .then((j) => {
        if (!mounted) return;

        const L = j.lesson as Lesson;
        setLesson(L);
        setEditDuration(L.duration_min);
        setEditDelivery(L.delivery);
        setEditLength(L.length_cat);
        setStudentName(j.studentName as string);
        setTeacherName(j.teacherName as string);
        setLots((j.lots ?? []) as LotRow[]);
        setSncStats((j.sncStats ?? null) as SncStats | null);
        setStudentTier((j.studentTier ?? null) as Tier | null);

        // Only run planner preview for pending lessons
        if (L.state === "pending") {
          fetchPreview(false);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(e.message);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // --- Confirm handler --------------------------------------------------

  async function onConfirm() {
    if (!lessonId || !lesson) return;
    setConfirming(true);
    setConfirmMsg(null);

    try {
      if (override && overrideReason.trim().length < 5) {
        throw new Error(
          "Please provide a short override reason (min 5 characters).",
        );
      }

      // 1) Persist edits (only if they differ)
      const newDuration = Number(editDuration || 0);
      const needsUpdate =
        lesson.delivery !== editDelivery ||
        lesson.length_cat !== editLength ||
        lesson.duration_min !== newDuration;

      if (needsUpdate) {
        const updRes = await fetch("/api/admin/lessons/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            delivery: editDelivery,
            length_cat: editLength,
            duration_min: newDuration,
          }),
        });
        const updJ = await updRes.json();
        if (!updRes.ok) {
          throw new Error(updJ.error || "Failed to save edits");
        }
      }

      // 2) Confirm lesson (rpc_confirm_lesson applies the same plan)
      const res = await fetch("/api/admin/lessons/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          override,
          reason: override ? overrideReason.trim() : undefined,
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || "Failed to confirm");
      }

      setConfirmMsg(
        j.statusMessage ??
          (needsUpdate
            ? "Edits saved, lesson confirmed."
            : "Lesson confirmed."),
      );

      // Reflect confirmed + edits locally
      setLesson({
        ...lesson,
        state: "confirmed",
        delivery: editDelivery,
        length_cat: editLength,
        duration_min: newDuration || lesson.duration_min,
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        setConfirmMsg(e.message);
      } else {
        setConfirmMsg("Unknown error while confirming");
      }
    } finally {
      setConfirming(false);
    }
  }

  const isPending = lesson?.state === "pending";
  const showOverride =
    isPending && (preview?.hasMandatoryExpiredLots ?? false);

  // Attach lot metadata to each preview step
  const planWithLots = useMemo(() => {
    if (!preview) return [];
    return preview.plan.map((step) => {
      const lot = step.creditLotId
        ? lots.find((l) => l.credit_lot_id === step.creditLotId) ?? null
        : null;
      return { ...step, lot };
    });
  }, [preview, lots]);

  if (loading) {
    return (
      <Section title="Review lesson">
        <p className="text-sm text-gray-600">Loading…</p>
      </Section>
    );
  }

  if (err) {
    return (
      <Section title="Review lesson">
        <AlertBanner severity="error">
          <strong>Something went wrong:</strong>{" "}
          <span>{err}</span>
        </AlertBanner>
      </Section>
    );
  }

  if (!lesson) {
    return (
      <Section title="Review lesson">
        <AlertBanner severity="error">
          <strong>Something went wrong:</strong>{" "}
          <span>No lesson data.</span>
        </AlertBanner>
      </Section>
    );
  }

  const isFreeSnc = !!(preview?.isSnc && preview?.isFreeSnc);
  const showsOverdraft = preview?.negativeBalance === true;

  const confirmSeverity = confirmMsg
    ? (confirmMsg.includes("confirmed") ? "success" : "error")
    : null;

  return (
    <Section
      title="Review lesson"
      subtitle="Inspect the FIFO allocation preview, then confirm."
    >
      {/* Top bar with back link */}
      <div className="mt-2 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/lessons/queue"
          className="inline-flex items-center text-xs text-gray-700 hover:underline"
        >
          ← Back to lesson queue
        </Link>
      </div>

      {/* DB-backed hazards (real data, with resolve buttons).
          Only show once the lesson is no longer pending, so we don't
          show a “no hazards” banner while still in preview-only mode. */}
      {!isPending && <LessonHazards lessonId={lessonId} />}

      {/* SNC monthly info (only shows for SNC lessons) */}
      <SNCInfoPanel
        isSnc={lesson.is_snc}
        sncStats={sncStats}
        studentTier={studentTier}
      />

      {/* Lesson meta + editable fields */}
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-gray-500">When:</span>{" "}
          {formatDateTimeLondon(lesson.occurred_at)}
        </div>
        <div>
          <span className="text-gray-500">State:</span> {lesson.state}
          {lesson.is_snc && (
            <StatusPill
              severity="warningSoft"
              label="Short-notice cancellation"
              className="ml-2 text-[11px]"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">Student:</span>
          <Link
            href={`/admin/students/${lesson.student_id}`}
            className="font-medium underline hover:no-underline"
          >
            {studentName}
          </Link>
          <TierBadge tier={studentTier} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">Teacher:</span>
          <Link
            href={`/admin/teachers/${lesson.teacher_id}`}
            className="font-medium underline hover:no-underline"
          >
            {teacherName}
          </Link>
        </div>

        {/* Delivery (editable) */}
        <label className="flex items-center gap-2">
          <span className="text-gray-500">Delivery:</span>
          <select
            className="rounded border px-2 py-1"
            value={editDelivery}
            onChange={(e) => setEditDelivery(e.target.value as Delivery)}
          >
            {DELIVERY.map((value) => (
              <option key={value} value={value}>
                {formatDeliveryUiLabel(value)}
              </option>
            ))}
          </select>
        </label>

        {/* Length category (editable) */}
        <label className="flex items-center gap-2">
          <span className="text-gray-500">Length category:</span>
          <select
            className="rounded border px-2 py-1"
            value={editLength}
            onChange={(e) => setEditLength(e.target.value as LengthCat)}
            disabled={!isPending}
          >
            {LENGTH_RESTRICTIONS.map((length) => (
              <option key={length} value={length}>
                {length === "none"
                  ? "—"
                  : formatLengthRestrictionLabel(length)}
              </option>
            ))}
          </select>
        </label>

        {/* Duration minutes (editable) */}
        <label className="flex items-center gap-2">
          <span className="text-gray-500">Duration (min):</span>
          <input
            type="number"
            min={1}
            step={5}
            className="w-28 rounded border px-2 py-1"
            value={editDuration}
            onChange={(e) => {
              const v = e.target.value;
              setEditDuration(v === "" ? "" : Math.max(0, Number(v)));
            }}
            disabled={!isPending}
          />
        </label>

        {lesson.notes ? (
          <div className="sm:col-span-2">
            <span className="text-gray-500">Notes:</span> {lesson.notes}
          </div>
        ) : null}
      </div>

      {/* Header row with planner hazard badges + confirm */}
      <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Allocation preview</h2>
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="flex gap-2">
            {preview?.counterDelivery && (
              <HazardBadge kind="counter-delivery" />
            )}
            {preview?.lengthViolation && (
              <HazardBadge kind="length-violation" />
            )}
            {preview?.negativeBalance && (
              <HazardBadge kind="negative-balance" />
            )}
          </div>
          {confirmMsg && confirmSeverity && (
            <StatusPill
              severity={confirmSeverity}
              label={confirmMsg}
              className="text-xs"
            />
          )}
          {isPending ? (
            <button
              onClick={onConfirm}
              disabled={
                confirming || (override && overrideReason.trim().length < 5)
              }
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-60"
            >
              {confirming ? "Confirming…" : "Confirm lesson"}
            </button>
          ) : (
            <StatusPill
              severity="success"
              label="Confirmed"
              className="text-sm"
            />
          )}
        </div>
      </div>

      {/* Admin override bar – only shown when there are expired mandatory lots */}
      {showOverride && (
        <AlertBanner
          severity="warningCritical"
          className="mb-3 rounded-xl text-sm"
        >
          <div className="mb-2 font-medium">Confirm options</div>

          <label className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) => {
                const checked = e.target.checked;
                setOverride(checked);
                // Only re-run planner preview for pending lessons
                if (lesson?.state === "pending") {
                  fetchPreview(checked);
                }
              }}
            />
            <span>Override expiry (admin)</span>
          </label>

          {override && (
            <label className="block">
              <div className="text-xs text-gray-600">
                Reason (required if override)
              </div>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="mt-1 w-full rounded-md border p-2"
                rows={2}
                placeholder="e.g. Mandatory lot expired due to holiday break; goodwill exception."
              />
            </label>
          )}

          <p className="mt-2 text-xs text-gray-600">
            Policy: expired lots are allowed unless{" "}
            <code>expiry_policy = mandatory</code>. Tick override to allow
            allocation even for expired mandatory lots (logged with reason).
          </p>
        </AlertBanner>
      )}

      {/* Plan table / explainer */}
      {previewLoading && !preview ? (
        <p className="text-sm text-gray-600">Computing preview…</p>
      ) : previewErr && !preview ? (
        <AlertBanner severity="error">
          <strong>Failed to load preview:</strong>{" "}
          <span>{previewErr}</span>
        </AlertBanner>
      ) : planWithLots.length === 0 ? (
        // No allocation steps – interpret via planner flags, not guesses.
        isFreeSnc ? (
          <p className="text-sm text-gray-600">
            This is a{" "}
            <strong>free short-notice cancellation</strong>. No credit will
            be deducted and no overdraft will be created when you confirm.
          </p>
        ) : showsOverdraft ? (
          <p className="text-sm text-gray-600">
            No open credit lots found. This lesson would be confirmed as an{" "}
            <strong>overdraft</strong>.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            This lesson will be{" "}
            <strong>confirmed without allocating any credit</strong>.
          </p>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Constraints</th>
                <th className="py-2 pr-4">Remaining (before)</th>
                <th className="py-2 pr-4">Allocate</th>
                <th className="py-2 pr-4">Remaining (after)</th>
              </tr>
            </thead>
            <tbody>
              {planWithLots.map((step, idx) => {
                const lot = step.lot as LotRow | null;

                const source = !lot
                  ? "Overdraft (no lot)"
                  : formatLotLabel(
                      lot.source_type,
                      lot.external_ref,
                      lot.award_reason_code,
                    );

                const constraints = lot
                  ? [
                      lot.delivery_restriction
                        ? formatDeliveryRestrictionLabel(
                            lot.delivery_restriction,
                          )
                        : null,
                      lot.tier_restriction
                        ? `${lot.tier_restriction}`
                        : null,
                      lot.length_restriction &&
                      lot.length_restriction !== "none"
                        ? `${formatLengthRestrictionLabel(
                            lot.length_restriction,
                          )} min only`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Any"
                  : "—";

                return (
                  <tr key={idx} className="border-b">
                    <td className="py-2 pr-4">{source}</td>
                    <td className="py-2 pr-4">{constraints}</td>
                    <td className="py-2 pr-4">
                      {formatMinutesAsHours(step.fromRemaining)} h
                    </td>
                    <td className="py-2 pr-4">{step.allocate} min</td>
                    <td className="py-2 pr-4">
                      {formatMinutesAsHours(step.toRemaining)} h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
