"use client";

import { useLocale, useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { eur, pct } from "@/lib/format";
import { GOAL, START, DEADLINE } from "@/lib/metrics";
import { hitRate, median, shareSaveRate, bestMetric, tagWinners, revenueByChannel, rate, type Content, type Metric, type SaleAttr } from "@/lib/marketing";
import { MetricCard, Panel, HBars, Empty } from "@/components/finance/overview";

/** Pulse: the weekly scorecard in a fixed order — North Star, channels, the 4 inputs, data quality, what to do next. */
export function Pulse({ items, metrics, sales, profit, codeChannel, inquiries, today }: {
  items: Content[]; metrics: Metric[]; sales: (SaleAttr & { date: string })[]; profit: number; codeChannel: Record<string, string>;
  inquiries: { date: string; converted_sale_id: string | null }[]; today: string;
}) {
  const t = useTranslations("marketing.pulse");
  const tt = useTranslations("marketing.tags");
  const locale = useLocale();
  const d = (k: number) => new Date(Date.parse(today + "T12:00:00Z") - k * 864e5).toISOString().slice(0, 10);

  // North Star: contribution profit vs the straight-line pace to €15K
  const elapsed = Math.max(0, (Date.parse(today) - Date.parse(START)) / 864e5), total = (Date.parse(DEADLINE) - Date.parse(START)) / 864e5;
  const pace = (GOAL.profit * elapsed) / total;
  const posted7 = items.filter((c) => c.posted_at && c.posted_at.slice(0, 10) >= d(6)).length;
  const recent = items.filter((c) => c.posted_at && c.posted_at.slice(0, 10) >= d(29));
  const hr = hitRate(items, metrics);
  const ssr = median(recent.map((c) => shareSaveRate(bestMetric(c.id, metrics))).filter((x): x is number => x !== null));
  const inq30 = inquiries.filter((i) => i.date >= d(29));
  const inqRate = rate(inq30.filter((i) => i.converted_sale_id).length, inq30.length);
  const channels = revenueByChannel(sales.filter((s) => s.date >= d(29)), codeChannel);
  const w = tagWinners(items, metrics);

  // Data quality: what's missing for the numbers to be right
  const missing7d = items.filter((c) => c.posted_at && Date.parse(c.posted_at) < Date.now() - 7 * 864e5 && !metrics.some((m) => m.content_id === c.id && m.age_hours === 168)).length;
  const untagged = items.filter((c) => c.status === "posted" && (!c.tags?.format || !c.tags?.hook_message || !c.tags?.channel)).length;
  const noHeard = sales.filter((s) => !s.reverses_id && Number(s.amount) > 0 && !s.heard_about).length;
  const issues = [missing7d && t("dq.missing7d", { count: missing7d }), untagged && t("dq.untagged", { count: untagged }), noHeard && t("dq.noHeard", { count: noHeard })].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <Panel title={t("northStar")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="readout text-3xl">{eur(profit, locale)} <span className="text-base font-normal text-muted">/ {eur(GOAL.profit, locale)}</span></p>
          <p className={`text-sm font-medium ${profit >= pace ? "text-ok-text" : "text-warn-text"}`}>{profit >= pace ? t("ahead", { amount: eur(profit - pace, locale) }) : t("behind", { amount: eur(pace - profit, locale) })}</p>
        </div>
        {/* Bullet graph: bar = profit so far, tick = where the straight-line pace says we should be today */}
        <div className="relative mt-3 h-4 rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={GOAL.profit} aria-valuenow={Math.round(profit)} aria-label={t("northStar")}>
          <div className="h-full rounded-full bg-climbed" style={{ width: `${Math.min(100, Math.max(0, profit / GOAL.profit) * 100)}%` }} />
          <span aria-hidden className="absolute -top-1 h-6 w-0.5 bg-ink" style={{ left: `${Math.min(100, (pace / GOAL.profit) * 100)}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">{t("paceNote", { amount: eur(pace, locale) })}</p>
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("inputs.posts")} value={String(posted7)} explain={t("explain.posts")} />
        <MetricCard label={t("inputs.hitRate")} value={pct(hr, locale)} explain={t("explain.hitRate")} />
        <MetricCard label={t("inputs.shareSave")} value={ssr === null ? "—" : pct(ssr, locale)} explain={t("explain.shareSave")} />
        <MetricCard label={t("inputs.inquiries")} value={pct(inqRate, locale)} explain={t("explain.inquiries")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("channels")}>
          {channels.length ? <HBars rows={channels.map((c) => ({ label: t.has(`channelNames.${c.channel}`) ? t(`channelNames.${c.channel}`) : c.channel, value: c.revenue }))} locale={locale} /> : <Empty text={t("noSales")} />}
        </Panel>
        <Panel title={t("next")}>
          {w.doMore.length || w.stop.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ok-text"><TrendingUp size={15} /> {t("doMore")}</p>
                <ul className="space-y-1 text-sm">{w.doMore.map((x) => <li key={x.key + x.value}><span className="text-muted">{tt(x.key)}:</span> {x.value} <span className="text-xs text-muted">· {pct(x.rate, locale)} · {t("posts", { count: x.posts })}</span></li>)}</ul></div>
              <div><p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-bad-text"><TrendingDown size={15} /> {t("stop")}</p>
                <ul className="space-y-1 text-sm">{w.stop.map((x) => <li key={x.key + x.value}><span className="text-muted">{tt(x.key)}:</span> {x.value} <span className="text-xs text-muted">· {pct(x.rate, locale)} · {t("posts", { count: x.posts })}</span></li>)}</ul></div>
            </div>
          ) : <Empty text={t("needData")} />}
        </Panel>
      </div>

      <section className={`panel flex items-start gap-3 p-4 ${issues.length ? "" : ""}`}>
        {issues.length ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn-text" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok-text" />}
        <div className="text-sm"><p className="font-medium">{issues.length ? t("dq.title") : t("dq.ok")}</p>{issues.map((i) => <p key={i} className="text-muted">{i}</p>)}</div>
      </section>
    </div>
  );
}
