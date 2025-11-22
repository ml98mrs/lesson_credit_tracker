// app/(admin)/admin/lessons/[lessonId]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Section from '@/components/ui/Section';
import HazardBadge from '@/components/badges/HazardBadge';
import { formatDateTimeUK } from '@/lib/formatters';
import { getAdminSupabase } from '@/lib/supabase/admin';


type Lesson = {
  id: string;
  student_id: string;
  teacher_id: string;
  occurred_at: string;
  duration_min: number;
  delivery: 'online' | 'f2f';
  length_cat: 'none' | '60' | '90' | '120';
  state: 'pending' | 'confirmed' | 'declined';
  notes: string | null;
};

type LotRow = {
  credit_lot_id: string;
  student_id: string;
  source_type: 'invoice' | 'award' | 'adjustment';
  award_reason_code: string | null;
  external_ref: string | null;
  minutes_granted: number;
  minutes_allocated: number;
  minutes_remaining: number;
  is_overdrawn: boolean | null;
  delivery_restriction: 'online' | 'f2f' | null;
  tier_restriction: 'basic' | 'premium' | 'elite' | null;
  length_restriction: '60' | '90' | '120' | null;
  start_date: string;
  expiry_date: string | null;
  state: 'open' | 'closed' | 'expired';
};

type ProfilesEmbed = { full_name: string } | { full_name: string }[] | null | undefined;
const AWARD_LABEL: Record<string, string> = {
  trial: 'Trial',
  promo: 'Promo',
  goodwill: 'Goodwill',
  free_cancellation: 'Free cancellation',
};


// Read full_name from either an object or array embed safely
function readFullName(p: ProfilesEmbed): string | undefined {
  if (!p) return undefined;
  return Array.isArray(p) ? p[0]?.full_name : p.full_name;
}

// FIFO preview: exact (delivery+length) → length-only → any; overdraft if needed
function buildPreview(lesson: Lesson, lots: LotRow[]) {
  let minutesNeeded = lesson.duration_min;

  const exact = lots.filter((lot) => {
    const deliveryOk = lot.delivery_restriction === null || lot.delivery_restriction === lesson.delivery;
    const lengthOk = lot.length_restriction === null || lot.length_restriction === lesson.length_cat;
    return deliveryOk && lengthOk;
  });

  const lengthOnly = lots.filter((lot) => {
    const lengthOk = lot.length_restriction === null || lot.length_restriction === lesson.length_cat;
    return lengthOk;
  });

  const any = lots;

  const ordered: LotRow[] = [];
  const seen = new Set<string>();
  for (const pool of [exact, lengthOnly, any]) {
    for (const lot of pool) {
      if (!seen.has(lot.credit_lot_id)) {
        seen.add(lot.credit_lot_id);
        ordered.push(lot);
      }
    }
  }

  const plan: {
    lot: LotRow | null; // null for synthetic overdraft
    fromRemaining: number;
    allocate: number;
    toRemaining: number;
    counterDelivery: boolean;
    lengthViolation: boolean;
  }[] = [];

  let counterDelivery = false;
  let lengthViolation = false;

  for (const lot of ordered) {
    if (minutesNeeded <= 0) break;
    const rem = lot.minutes_remaining;
    if (rem <= 0) continue;

    const take = Math.min(rem, minutesNeeded);

    const cd = lot.delivery_restriction !== null && lot.delivery_restriction !== lesson.delivery;
    const lv = lot.length_restriction !== null && lot.length_restriction !== lesson.length_cat;

    if (cd) counterDelivery = true;
    if (lv) lengthViolation = true;

    plan.push({
      lot,
      fromRemaining: rem,
      allocate: take,
      toRemaining: rem - take,
      counterDelivery: cd,
      lengthViolation: lv,
    });

    minutesNeeded -= take;
  }

  let negativeBalance = false;

  if (minutesNeeded > 0) {
    negativeBalance = true;
    const lastStep = plan.length ? plan[plan.length - 1] : null;
    const fromRemaining = lastStep ? lastStep.toRemaining : 0;
    plan.push({
      lot: lastStep?.lot ?? null,
      fromRemaining,
      allocate: minutesNeeded,
      toRemaining: fromRemaining - minutesNeeded,
      counterDelivery: false,
      lengthViolation: false,
    });
    minutesNeeded = 0;
  }

  return { plan, counterDelivery, lengthViolation, negativeBalance };
}

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    v
  );
}
export default async function AdminLessonReview({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams?: { id?: string };
}) {
  const { lessonId: routeLessonId } = await params;

  // Use the route param if present; otherwise fall back to ?id=…
  const lessonId = routeLessonId || searchParams?.id || "";

  if (!lessonId) {
    return (
      <Section title="Review lesson">
        <p className="text-sm text-rose-700">
          Missing lesson id (neither route param nor ?id provided).
        </p>
      </Section>
    );
  }

  const supabase = getAdminSupabase();

  const { data: lesson, error: lerr } = await supabase
    .from("lessons")
    .select(
      "id,student_id,teacher_id,occurred_at,duration_min,delivery,length_cat,state,notes",
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (lerr) {
    return (
      <Section title="Review lesson">
        <p className="text-sm text-rose-700">
          DB error while loading lesson <code className="font-mono">{lessonId}</code>: {lerr.message}
        </p>
      </Section>
    );
  }
  if (!lesson) {
    return (
      <Section title="Review lesson">
        <p className="text-sm text-rose-700">
          Lesson not found for id <code className="font-mono">{lessonId}</code>.
        </p>
      </Section>
    );
  }

  const L = lesson as Lesson;


  // 2) Names (robust to array/object embeds)
  const sRes = await supabase.from('students').select('id, profiles(full_name)').eq('id', L.student_id).single();
  const tRes = await supabase.from('teachers').select('id, profiles(full_name)').eq('id', L.teacher_id).single();

  const studentName = readFullName((sRes.data as any)?.profiles) ?? '(student)';
  const teacherName = readFullName((tRes.data as any)?.profiles) ?? '(teacher)';

  // 3) Open lots for the student (FIFO by start_date)
  const lRes = await supabase
    .from('v_credit_lot_remaining')
    .select(
      [
        'credit_lot_id',
        'student_id',
        'source_type',
        'award_reason_code',
        'external_ref',
        'minutes_granted',
        'minutes_allocated',
        'minutes_remaining',
        'delivery_restriction',
        'tier_restriction',
        'length_restriction',
        'start_date',
        'expiry_date',
        'state',
      ].join(',')
    )
    .eq('student_id', L.student_id)
    .eq('state', 'open')
    .order('start_date', { ascending: true });

  if (lRes.error) throw new Error(lRes.error.message);
  const lots: LotRow[] = ((lRes.data as unknown) as LotRow[]) ?? [];

  const { plan, counterDelivery, lengthViolation, negativeBalance } = buildPreview(L, lots);

  return (
    <Section title="Review lesson" subtitle="Edit details if needed and inspect the FIFO allocation preview (no database changes yet).">
      {/* Lesson header */}
      <div className="border rounded-lg p-4 mb-6">
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">When:</span> {formatDateTimeUK(L.occurred_at)}</div>
          <div><span className="text-gray-500">State:</span> {L.state}</div>
          <div><span className="text-gray-500">Student:</span> {studentName}</div>
          <div><span className="text-gray-500">Teacher:</span> {teacherName}</div>
          <div><span className="text-gray-500">Delivery:</span> {L.delivery === 'f2f' ? 'F2F' : 'Online'}</div>
          <div><span className="text-gray-500">Length category:</span> {L.length_cat === 'none' ? '—' : `${L.length_cat} min`}</div>
          <div><span className="text-gray-500">Duration:</span> {L.duration_min} min</div>
          {L.notes ? <div className="sm:col-span-2"><span className="text-gray-500">Notes:</span> {L.notes}</div> : null}
        </div>
      </div>

      {/* Allocation preview */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Allocation preview</h2>
        <div className="flex gap-2">
          {counterDelivery && <HazardBadge kind="counter-delivery" />}
          {lengthViolation && <HazardBadge kind="length-violation" />}
          {negativeBalance && <HazardBadge kind="negative-balance" />}
        </div>
      </div>

      {plan.length === 0 ? (
        <p className="text-sm text-gray-600">
          No open credit lots found. This lesson would be confirmed as an <strong>overdraft</strong> (negative balance).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Constraints</th>
                <th className="py-2 pr-4">Remaining (before)</th>
                <th className="py-2 pr-4">Allocate</th>
                <th className="py-2 pr-4">Remaining (after)</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((step, idx) => {
                const lot = step.lot;
                const source = !lot
                  ? 'Overdraft (no lot)'
                  : lot.source_type === 'invoice'
                  ? `Invoice${lot.external_ref ? ` (${lot.external_ref})` : ''}`
                  : lot.source_type === 'award'
                  ? `Award${lot.award_reason_code ? ` — ${AWARD_LABEL[lot.award_reason_code] ?? lot.award_reason_code}` : ''}`
                  : 'Adjustment';

                const constraints = lot
                  ? [
                      lot.delivery_restriction ? (lot.delivery_restriction === 'f2f' ? 'F2F only' : 'Online only') : null,
                      lot.tier_restriction ? `${lot.tier_restriction}` : null,
                      lot.length_restriction ? `${lot.length_restriction} min only` : null,
                    ].filter(Boolean).join(' · ') || 'Any'
                  : '—';

                return (
                  <tr key={idx} className="border-b">
                    <td className="py-2 pr-4">{source}</td>
                    <td className="py-2 pr-4">{constraints}</td>
                    <td className="py-2 pr-4">{step.fromRemaining} min</td>
                    <td className="py-2 pr-4">{step.allocate} min</td>
                    <td className="py-2 pr-4">{step.toRemaining} min</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        This is a preview only. Next we’ll add a transactional RPC to confirm the lesson and write the
        <code> allocations</code> rows exactly as shown here (including overdraft and hazard flags).
      </p>
    </Section>
  );
}
