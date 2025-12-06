// components/ui/AlertBanner.tsx
import type { UiSeverity } from "@/lib/ui/severity";
import { getBannerClasses } from "@/lib/ui/severity";

type AlertBannerProps = {
  severity: UiSeverity;
  children: React.ReactNode;
  className?: string;
};

export function AlertBanner({
  severity,
  children,
  className,
}: AlertBannerProps) {
  return <div className={`${getBannerClasses(severity)} ${className ?? ""}`}>{children}</div>;
}
