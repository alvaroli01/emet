import { useTranslations } from "next-intl";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { Health } from "@/lib/metrics";

const MAP = {
  good: { Icon: CheckCircle2, text: "text-ok-text" },
  warning: { Icon: AlertTriangle, text: "text-warn-text" },
  critical: { Icon: XCircle, text: "text-bad-text" },
} as const;

/** Status always = icon + word + colour, never colour alone. */
export function StatusPill({ status, label }: { status: Health; label?: string }) {
  const t = useTranslations("status");
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.text}`}>
      <s.Icon size={14} aria-hidden />
      {label ?? t(status)}
    </span>
  );
}

/** Pick a status from a value vs its target (higher is better). null value → no data. */
export function statusFor(value: number | null, target: number, amberBelow = 0.85): Health | null {
  if (value === null) return null;
  if (value >= target) return "good";
  if (value >= target * amberBelow) return "warning";
  return "critical";
}
