"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { Megaphone, Users, TrendingUp, Search, ExternalLink, ChevronRight } from "lucide-react";
import { eur, num, pct, shortDate } from "@/lib/format";
import type { MarketingDash } from "@/lib/marketing-dash";

const ORANGE = "#ff7a2e", GOLD = "#ffc23d", WHITE = "#f5f5f7";
const tick = { fill: "var(--muted)", fontSize: 11 };

/** KPI card from the example: title + icon, big number, a progress line, two small sub-stats. */
function KpiCard({ title, icon, value, progress, a, b }: { title: string; icon: React.ReactNode; value: string; progress: number | null; a: [string, string]; b: [string, string] }) {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-[15px] font-medium">{title}</p><p className="readout mt-2 text-3xl">{value}</p></div>
        <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(Math.max(0, Math.min(1, progress ?? 0)) * 100)}%` }} /></div>
      <dl className="mt-4 grid grid-cols-2 divide-x divide-line text-sm">
        <div className="pr-3"><dt className="text-xs text-muted">{a[0]}</dt><dd className="readout text-xl">{a[1]}</dd></div>
        <div className="pl-3"><dt className="text-xs text-muted">{b[0]}</dt><dd className="readout text-xl">{b[1]}</dd></div>
      </dl>
    </section>
  );
}

/** Marketing — modelled on "marketing example 2", in the home page's look (dark glass, orange/gold/white). */
export function MarketingDashboard({ d }: { d: MarketingDash }) {
  const t = useTranslations("marketingDash");
  const tc = useTranslations("marketing.pulse.channelNames");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const channel = (k: string) => (tc.has(k) ? tc(k) : k);
  const share = d.revenue30 ? d.marketingRevenue30 / d.revenue30 : null;
  const top = d.top.filter((x) => x.title.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="fade-in space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <p className="text-sm text-muted">{t("subtitle")}</p>
          <h1 className="mt-1 text-[clamp(1.7rem,3.5vw,2.4rem)] font-medium tracking-tight">{t("title")}</h1>
        </div>
        <nav className="flex gap-2" aria-label={t("jump")}>
          <Link href="/g/marketing?tab=content" className="glass-pill h-10 px-4 text-sm">{t("content")}</Link>
          <Link href="/g/marketing?tab=attribution" className="glass-pill h-10 px-4 text-sm">{t("links")}</Link>
          <Link href="/g/marketing?tab=pulse" className="glass-pill h-10 bg-brand px-4 text-sm font-semibold text-white">{t("pulse")}</Link>
        </nav>
      </header>

      {/* Row 1: three KPI cards (the third with a line chart) */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title={t("keyPerformance")} icon={<Megaphone size={20} />} value={eur(d.marketingRevenue30, locale)} progress={share}
                 a={[t("reach"), num(d.reach30, locale)]} b={[t("revenueAll"), eur(d.revenue30, locale)]} />
        <KpiCard title={t("conversion")} icon={<Users size={20} />} value={d.conversion === null ? "—" : pct(d.conversion, locale)} progress={d.conversion}
                 a={[t("dms"), num(d.inquiries30, locale)]} b={[t("orders"), num(d.orders30, locale)]} />
        <section className="panel p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-[15px] font-medium">{t("analytics")}</p><p className="readout mt-2 text-3xl">{num(d.views30, locale)}</p><p className="text-xs text-muted">{t("views30")}</p></div>
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand"><TrendingUp size={20} /></span>
          </div>
          <div className="mt-2 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.viewsWeekly} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                <defs><linearGradient id="mkA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ORANGE} stopOpacity={0.45} /><stop offset="1" stopColor={ORANGE} stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="week" tickFormatter={(w) => shortDate(String(w), locale)} tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <Area type="monotone" dataKey="views" stroke={ORANGE} strokeWidth={2.2} fill="url(#mkA)" dot={{ r: 2.5, fill: ORANGE }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Row 2: traffic by channel (area) + daily traffic (bars) */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="panel p-5">
          <p className="text-lg font-medium">{t("socialTraffic")}</p>
          <p className="text-xs text-muted">{t("socialTrafficSub")}</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.channelCounts.map((c) => ({ ...c, label: channel(c.name) }))} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <defs><linearGradient id="mkB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={GOLD} stopOpacity={0.35} /><stop offset="1" stopColor={GOLD} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="glass rounded-xl px-3 py-2 text-xs">{String(payload[0].payload.label)}: <b>{t("salesN", { count: Number(payload[0].value) })}</b></div> : null} />
                <Area type="monotone" dataKey="value" stroke={GOLD} strokeWidth={2.5} fill="url(#mkB)" dot={{ r: 3, fill: GOLD }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-5">
          <p className="text-lg font-medium">{t("dailyTraffic")}</p>
          <p className="flex gap-3 text-xs text-muted"><span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: ORANGE }} /> {t("clicks")}</span><span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: WHITE }} /> {t("dmsShort")}</span></p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.daily} margin={{ top: 10, right: 4, left: -24, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="day" tickFormatter={(x) => String(x).slice(8)} tick={tick} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => active && payload?.length ? <div className="glass rounded-xl px-3 py-2 text-xs"><p className="text-muted">{shortDate(String(payload[0].payload.day), locale)}</p><p>{t("clicks")}: <b>{payload[0].payload.clicks}</b> · {t("dmsShort")}: <b>{payload[0].payload.dms}</b></p></div> : null} />
                <Bar dataKey="clicks" fill={ORANGE} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="dms" fill={WHITE} fillOpacity={0.75} radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Row 3: recent activities (top content table) + marketing goal (donut + world map) */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section>
          <p className="mb-3 text-lg font-medium">{t("recentActivities")}</p>
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 pt-4">
              <p className="font-medium">{t("topContent")}</p>
              <label className="glass-pill h-9 px-3 text-sm"><Search size={14} className="text-muted" /><span className="sr-only">{t("search")}</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="w-28 bg-transparent outline-none placeholder:text-muted focus-visible:outline-none" /></label>
            </div>
            {top.length ? (
              <table className="mt-2 w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2 font-medium">{t("post")}</th><th className="py-2 font-medium">{t("views")}</th><th className="px-5 py-2 text-right font-medium">{t("shareSaveShort")}</th></tr></thead>
                <tbody>
                  {top.map((x, i) => (
                    <tr key={x.id} className={i % 2 ? "" : "bg-surface-2/50"}>
                      <td className="max-w-0 truncate px-5 py-3">{x.permalink ? <a href={x.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand">{x.title} <ExternalLink size={11} /></a> : x.title}</td>
                      <td className="py-3 tabular-nums">{num(x.views, locale)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{x.ssr === null ? "—" : pct(x.ssr, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="px-5 py-10 text-center text-sm text-muted">{t("noPosts")}</p>}
            <Link href="/g/marketing?tab=content" className="flex items-center justify-end gap-1 px-5 py-3 text-xs text-muted hover:text-ink">{t("allContent")} <ChevronRight size={13} /></Link>
          </div>
        </section>
        <section className="panel relative overflow-hidden p-5">
          <p className="text-lg font-medium">{t("goal")}</p>
          <div className="mt-2 grid items-center gap-4 sm:grid-cols-[180px_1fr]">
            <div>
              <div className="relative mx-auto size-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ v: share ?? 0 }, { v: 1 - (share ?? 0) }]} dataKey="v" innerRadius={52} outerRadius={72} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                      <Cell fill={ORANGE} /><Cell fill="rgb(255 255 255 / 0.1)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <p className="readout absolute inset-0 grid place-items-center text-2xl">{share === null ? "—" : pct(share, locale)}</p>
              </div>
              <p className="mt-1 text-center text-xs text-muted">{t("goalSub")}</p>
            </div>
            <div className="relative">
              <svg viewBox="0 0 1000 500" className="w-full" aria-hidden>
                <path d={d.world} fill="rgb(255 255 255 / 0.85)" stroke="none" />
                <circle cx={d.worldBilbao[0]} cy={d.worldBilbao[1]} r="34" fill={ORANGE} fillOpacity="0.25" />
                <circle cx={d.worldBilbao[0]} cy={d.worldBilbao[1]} r="12" fill={ORANGE} stroke="white" strokeWidth="4" />
              </svg>
              <p className="mt-1 text-right text-xs text-muted">{t("basedIn")}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
