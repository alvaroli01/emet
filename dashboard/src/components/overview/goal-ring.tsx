import { useLocale, useTranslations } from "next-intl";
import { eur } from "@/lib/format";

/** Big progress ring for a money goal. The number and % are always written out — the ring is a bonus, not the only cue. */
export function GoalRing({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const pct = goal > 0 ? Math.max(0, value / goal) : 0;
  const shown = Math.min(1, pct);
  const r = 52, c = 2 * Math.PI * r;
  const toGo = Math.max(0, goal - value);

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="size-28 shrink-0 -rotate-90 sm:size-32" role="img"
           aria-label={t("ringLabel", { label, value: eur(value, locale), goal: eur(goal, locale), pct: Math.round(pct * 100) })}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - shown)}
                style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)", animation: "ring-in 1s cubic-bezier(.2,.8,.2,1)" }} />
        <text x="60" y="60" transform="rotate(90 60 60)" textAnchor="middle" dominantBaseline="central" className="fill-ink text-[22px] font-semibold">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{eur(value, locale)}</p>
        <p className="text-sm text-muted tabular-nums">{t("of", { goal: eur(goal, locale) })}</p>
        <p className="mt-1 text-sm font-medium tabular-nums">{toGo > 0 ? t("toGo", { amount: eur(toGo, locale) }) : `${t("reached")} 🎉`}</p>
      </div>
    </div>
  );
}
