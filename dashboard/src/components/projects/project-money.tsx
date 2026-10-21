"use client";

import { useLocale, useTranslations } from "next-intl";
import { eur, shortDate } from "@/lib/format";
import type { Money } from "./project-page";

/** What Finance tagged to this project: revenue, costs, profit, and revenue week by week. */
export function ProjectMoney({ money, weeks, compact = false }: { money: Money; weeks: { week: string; revenue: number }[]; compact?: boolean }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const max = Math.max(1, ...weeks.map((w) => w.revenue));
  const tiles = [
    { label: t("money.revenue"), value: money.revenue, tone: "" },
    { label: t("money.costs"), value: money.costs, tone: "text-muted" },
    { label: t("money.profit"), value: money.profit, tone: money.profit < 0 ? "text-bad-text" : "text-ok-text" },
  ];
  return (
    <section className="panel p-5">
      <h2 className="mb-3 font-semibold">{t("tabs.money")}</h2>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl bg-surface-2/60 p-3">
            <p className="text-xs text-muted">{x.label}</p>
            <p className={`readout mt-1 text-lg font-semibold ${x.tone}`}>{eur(x.value, locale)}</p>
          </div>
        ))}
      </div>
      {!compact && (weeks.length ? (
        <div className="mt-5">
          <p className="mb-2 text-xs text-muted">{t("money.byWeek")}</p>
          <div className="flex h-40 items-end gap-1.5">
            {weeks.map((w) => (
              <div key={w.week} className="flex flex-1 flex-col items-center gap-1" title={`${shortDate(w.week, locale)} · ${eur(w.revenue, locale)}`}>
                <div className="w-full rounded-t-md bg-brand/80" style={{ height: `${Math.max(3, (w.revenue / max) * 100)}%` }} />
                <span className="text-[10px] text-muted">{shortDate(w.week, locale)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null)}
      {money.revenue === 0 && money.costs === 0 && <p className="mt-3 text-sm text-muted">{t("money.empty")}</p>}
    </section>
  );
}
