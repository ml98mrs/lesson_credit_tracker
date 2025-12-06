// lib/ui/severity.ts

export type UiSeverity =
  | "info"
  | "warningSoft"      // amber – “heads-up”
  | "warningCritical"  // red – critical business state (but not a system error)
  | "error"            // red – system/validation error
  | "success";

export function getBannerClasses(severity: UiSeverity): string {
  const base = "rounded-lg border px-3 py-2 text-xs";

  switch (severity) {
    case "warningSoft":
      return `${base} border-amber-200 bg-amber-50 text-amber-900`;
    case "warningCritical":
      // Still a “warning” conceptually, but visually red
      return `${base} border-red-200 bg-red-50 text-red-900`;
    case "error":
      // For system / validation errors only
      return `${base} border-red-300 bg-red-50 text-red-900`;
    case "success":
      return `${base} border-emerald-200 bg-emerald-50 text-emerald-900`;
    case "info":
    default:
      return `${base} border-sky-200 bg-sky-50 text-sky-900`;
  }
}

export function getPillClasses(severity: UiSeverity): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

  switch (severity) {
    case "warningSoft":
      return `${base} bg-amber-100 text-amber-800`;
    case "warningCritical":
      return `${base} bg-red-100 text-red-800`;
    case "error":
      return `${base} bg-red-200 text-red-900`;
    case "success":
      return `${base} bg-emerald-100 text-emerald-800`;
    case "info":
    default:
      return `${base} bg-sky-100 text-sky-800`;
  }
}
