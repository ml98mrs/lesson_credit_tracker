// components/banners/ExpirySoonBanner.tsx
import { formatDateTimeLondon } from "@/lib/formatters";

export default function ExpirySoonBanner({
  expiryDateUtc,
}: {
  expiryDateUtc?: string;
}) {
  if (!expiryDateUtc) return null;

  const formatted = formatDateTimeLondon(expiryDateUtc);
  // If your formatter returns "dd.mm.yyyy · HH:MM", grab the date part:
  const dateOnly = formatted.split(" ")[0];

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <strong>Heads up:</strong>{" "}
      Some of your credit is due to expire on <span className="font-semibold">{dateOnly}</span>.
    </div>
  );
}
