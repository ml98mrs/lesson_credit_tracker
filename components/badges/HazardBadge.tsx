// components/badges/HazardBadge.tsx
export default function HazardBadge({ kind }: { kind: 'counter-delivery' | 'length-violation' | 'negative-balance' }) {
  const m = {
    'counter-delivery': { label: 'Counter-delivery', color: 'bg-amber-200 text-amber-900' },
    'length-violation': { label: 'Length violation', color: 'bg-rose-200 text-rose-900' },
    'negative-balance': { label: 'Negative balance', color: 'bg-red-200 text-red-900' },
  }[kind];
  return <span className={`px-2 py-1 rounded text-xs font-medium ${m.color}`}>{m.label}</span>;
}
