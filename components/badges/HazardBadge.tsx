// components/badges/HazardBadge.tsx
import { StatusPill } from "@/components/ui/StatusPill";
import type { UiSeverity } from "@/lib/ui/severity";

export type HazardKind =
  | "counter-delivery"
  | "length-violation"
  | "negative-balance";

const HAZARD_META: Record<
  HazardKind,
  { label: string; severity: UiSeverity }
> = {
  "counter-delivery": {
    label: "Counter-delivery",
    severity: "warningSoft", // heads-up, usually not catastrophic
  },
  "length-violation": {
    label: "Length violation",
    severity: "warningCritical", // more serious business rule breach
  },
  "negative-balance": {
    label: "Negative balance",
    severity: "warningCritical", // critical business state, but not a system error
  },
};

export default function HazardBadge({ kind }: { kind: HazardKind }) {
  const meta = HAZARD_META[kind];

  return (
    <StatusPill
      severity={meta.severity}
      label={meta.label}
      className="text-[11px]"
    />
  );
}
