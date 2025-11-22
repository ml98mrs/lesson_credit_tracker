// app/(admin)/admin/lessons/review/ConfirmBar.tsx
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function ConfirmBar() {
  const sp = useSearchParams();
  const router = useRouter();

  // Use the new naming convention: ?lessonId=<uuid>
  const lessonId = sp.get('lessonId') ?? '';

  const [override, setOverride] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  async function onConfirm() {
    setSubmitting(true);
    setError(null);
    setOkMsg(null);

    try {
      if (!lessonId) {
        throw new Error('Missing lessonId in ?lessonId=');
      }

      if (override && reason.trim().length < 5) {
        throw new Error(
          'Please add a short reason (min 5 chars) for override.'
        );
      }

      const res = await fetch('/api/admin/lessons/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,                                // 👈 important key
          override,
          reason: override ? reason.trim() : undefined,
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || 'Failed to confirm');
      }

      setOkMsg('Lesson confirmed.');
      // Refresh any server components on the page (if there are any)
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border p-4">
      <div className="mb-2 font-medium">Confirm lesson</div>

      <label className="mb-2 flex items-center gap-2">
        <input
          type="checkbox"
          checked={override}
          onChange={(e) => setOverride(e.target.checked)}
        />
        <span>Override expiry (admin)</span>
      </label>

      {override && (
        <label className="mb-3 block">
          <div className="text-sm text-gray-600">
            Reason (required if override)
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-md border p-2"
            rows={2}
            placeholder="e.g. Student goodwill exception; locked-out session; holiday delay."
          />
        </label>
      )}

      {error && (
        <div className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {okMsg && (
        <div className="mb-2 rounded-md bg-green-50 p-2 text-sm text-green-700">
          {okMsg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          disabled={submitting || (override && reason.trim().length < 5)}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Confirming…' : 'Confirm lesson'}
        </button>
      </div>
    </div>
  );
}
