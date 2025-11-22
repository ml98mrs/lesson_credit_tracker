'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Section from '@/components/ui/Section';
import { formatMinutesAsHours } from '@/lib/formatters';
import { formatLotLabel, CreditLotSource } from "@/lib/credit-lot-labels";


type Row = {
  id: string;
  credit_lot_id: string;
  minutes_allocated: number;
  source_type: CreditLotSource | null;
  external_ref: string | null;
  award_reason_code: string | null;
};


const AWARD_LABEL: Record<string, string> = {
  trial: 'Trial',
  promo: 'Promo',
  goodwill: 'Goodwill',
  free_cancellation: 'Free cancellation',
};

// Little coloured badge for source type
function SourceChip({ type }: { type: Row['source_type'] }) {
  const base = 'px-2 py-0.5 rounded text-xs font-medium';
  if (type === 'invoice') return <span className={`${base} bg-blue-100 text-blue-800`}>Invoice</span>;
  if (type === 'award') return <span className={`${base} bg-emerald-100 text-emerald-800`}>Award</span>;
  if (type === 'overdraft') return <span className={`${base} bg-rose-100 text-rose-800`}>Overdraft</span>;
  if (type === 'adjustment') return <span className={`${base} bg-amber-100 text-amber-800`}>Adjustment</span>;
  return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
}


export default function AllocationsByLesson() {
  const sp = useSearchParams();
  const lessonId = sp.get('lessonId') ?? '';

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);

    if (!lessonId) {
      setErr('Missing ?lessonId');
      setLoading(false);
      return;
    }

    fetch(`/api/admin/allocations/by-lesson?lessonId=${encodeURIComponent(lessonId)}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || r.statusText);
        }
        return r.json();
      })
      .then((j) => {
        if (!mounted) return;
        setRows((j.allocations ?? []) as Row[]);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, [lessonId]);

  return (
    <Section
      title="Allocations for lesson"
      subtitle="Rows written to the allocations table (hours shown on UI)."
    >
      {!lessonId && (
        <p className="text-sm text-rose-700">
          Missing query param <code>?lessonId=</code>.
        </p>
      )}

      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {err && <p className="text-sm text-rose-700">{err}</p>}

      {!loading && !err && rows.length === 0 && lessonId && (
        <p className="text-sm text-gray-600">
          No allocations found for this lesson.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Details</th>
                <th className="py-2 pr-4">Credit lot</th>
                <th className="py-2 pr-4">Allocated (h)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
  const friendlyAwardReason =
    r.award_reason_code
      ? AWARD_LABEL[r.award_reason_code] ?? r.award_reason_code
      : null;

  const label = r.source_type
    ? formatLotLabel(r.source_type, r.external_ref, friendlyAwardReason)
    : '—';

  return (
    <tr key={r.id} className="border-b hover:bg-gray-50">
      <td className="py-2 pr-4">
        <SourceChip type={r.source_type} />
      </td>
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 pr-4 font-mono text-xs">{r.credit_lot_id}</td>
      <td className="py-2 pr-4">
        {formatMinutesAsHours(r.minutes_allocated)} h
      </td>
    </tr>
  );
})}

            </tbody>
          </table>
        </div>
      )}

      {lessonId && (
        <p className="text-xs text-gray-500 mt-3">
          Viewing allocations for lesson{' '}
          <span className="font-mono">{lessonId}</span>.
        </p>
      )}
    </Section>
  );
}
