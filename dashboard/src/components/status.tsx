import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { Health } from "@/lib/metrics";

const MAP = {
  good: { label: "On track", Icon: CheckCircle2, dot: "bg-ok", text: "text-ok-text" },
  warning: { label: "At risk", Icon: AlertTriangle, dot: "bg-warn", text: "text-warn-text" },
  critical: { label: "Behind", Icon: XCircle, dot: "bg-bad", text: "text-bad-text" },
} as const;

/** Status always = icon + word + colour, never colour alone. */
export function StatusPill({ status, label }: { status: Health; label?: string }) {
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.text}`}>
      <s.Icon size={14} aria-hidden />
      {label ?? s.label}
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
