"use client";

import { useLocale, useTranslations } from "next-intl";
import { BarChart3, Copy } from "lucide-react";
import { useToast } from "@/components/toast";
import { eur, pct, shortDate } from "@/lib/format";
import type { WeeklyReport } from "@/lib/weekly-report";

/** The automatic Friday report, in the reader's language, with a one-tap copy for the group chat. */
export function ReportCard({ report: r }: { report: WeeklyReport }) {
  const t = useTranslations("report");
  const locale = useLocale();
  const toast = useToast();
  const rows: [string, string][] = [
    [t("revenue"), eur(r.week_revenue, locale)],
    [t("profit"), `${eur(r.week_profit, locale)}${r.week_margin !== null ? ` · ${pct(r.week_margin, locale)}` : ""}`],
    [t("sales"), String(r.week_sales)],
    [t("tasksDone"), String(r.tasks_done)],
    [t("overdue"), String(r.tasks_overdue)],
    [t("onTime"), r.on_time_rate === null ? "—" : pct(r.on_time_rate, locale)],
    [t("blockers"), String(r.blockers_open)],
    [t("meetings"), String(r.meetings)],
  ];
  const text = [
    `📊 ${t("title", { date: shortDate(r.week, locale) })}`,
    ...rows.map(([k, v]) => `• ${k}: ${v}`),
    `• ${t("sinceStart")}: ${eur(r.total_revenue, locale)} / ${eur(30000, locale)} · ${t("profit").toLowerCase()} ${eur(r.total_profit, locale)} / ${eur(15000, locale)}`,
    `• ${t("needed", { amount: eur(r.revenue_per_week_needed, locale), days: r.days_left })}`,
    ...(r.top_idea ? [`💡 ${t("topIdea", { title: r.top_idea.title, score: r.top_idea.score })}`] : []),
  ].join("\n");
  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><BarChart3 size={18} /> {t("title", { date: shortDate(r.week, locale) })}</h2>
        <button onClick={async () => { await navigator.clipboard.writeText(text); toast("ok", t("copied")); }}
                className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-medium hover:bg-line"><Copy size={14} /> {t("copy")}</button>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="readout text-xl">{v}</dd></div>)}
      </dl>
      <p className="mt-4 text-sm text-muted">{t("needed", { amount: eur(r.revenue_per_week_needed, locale), days: r.days_left })}</p>
    </section>
  );
}
