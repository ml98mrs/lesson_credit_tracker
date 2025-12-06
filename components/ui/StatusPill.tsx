// components/ui/StatusPill.tsx
import type { UiSeverity } from "@/lib/ui/severity";
import { getPillClasses } from "@/lib/ui/severity";

type StatusPillProps = {
  severity: UiSeverity;
  label: string;
  className?: string;
};

export function StatusPill({ severity, label, className }: StatusPillProps) {
  return (
    <span className={`${getPillClasses(severity)} ${className ?? ""}`}>
      {label}
    </span>
  );
}
