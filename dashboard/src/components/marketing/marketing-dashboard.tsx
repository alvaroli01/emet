"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip } from "recharts";
import { ArrowLeft, Plus, SlidersHorizontal, LayoutGrid, MapPin } from "lucide-react";
import { eur, pct, shortDate } from "@/lib/format";
import type { MarketingDash } from "@/lib/marketing-dash";

const PIE = ["#8b7bff", "#ff8a5c", "#5ad1ff", "#ffd166", "#7cf0b1", "#f472b6"];

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel p-4">
      <p className="flex items-center justify-between text-sm font-medium">{label}<SlidersHorizontal size={14} className="text-muted" /></p>
      <p className="readout mt-2 text-3xl leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{sub}</p>
    </div>
  );
}

/** Marketing at a glance — modelled on the "marketing example": map backdrop, KPI cards, pie, radar, bubble grid. */
export function MarketingDashboard({ d, assistant }: { d: MarketingDash; assistant: React.ReactNode }) {
  const t = useTranslations("marketingDash");
  const tc = useTranslations("marketing.pulse.channelNames");
  const locale = useLocale();
  const maxV = Math.max(1, ...d.bubbles.cells.map((c) => c.v));
  const total = d.channels.reduce((a, c) => a + c.value, 0);

  return (
    <div className="fade-in grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        {/* Title bar */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/today" aria-label={t("back")} className="glass-pill grid size-10 place-items-center"><ArrowLeft size={17} /></Link>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <span className="text-muted">/</span>
          <span className="text-sm text-muted">{t("subtitle")}</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="glass-pill h-9 px-3.5 text-sm font-medium">{t("overview")}</span>
            <Link href="/g/marketing?tab=content#tools" aria-label={t("newContent")} className="glass-pill grid size-9 place-items-center"><Plus size={16} /></Link>
            <span className="glass-pill h-9 px-3.5 text-sm text-muted"><LayoutGrid size={14} /> {t("widgets", { count: 6 })}</span>
          </span>
        </div>

        {/* Map stage with floating cards */}
        <section className="relative isolate overflow-hidden rounded-[26px] border border-line bg-[#0b0d16] p-3 sm:p-4">
          <svg viewBox="0 0 600 400" className="pointer-events-none absolute top-1/2 right-0 -z-10 h-[115%] w-[85%] -translate-y-1/2 opacity-90" preserveAspectRatio="xMaxYMid meet" aria-hidden>
            <defs>
              <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#8b7bff" stopOpacity="0.9" /><stop offset="1" stopColor="#8b7bff" stopOpacity="0" /></radialGradient>
              <linearGradient id="landFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b4bd8" /><stop offset="1" stopColor="#1fb6c9" /></linearGradient>
            </defs>
            <path d={d.map.land} fill="url(#landFill)" fillOpacity="0.55" stroke="#9aa8ff" strokeOpacity="0.35" strokeWidth="0.8" />
            {[d.map.madrid, d.map.barcelona].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#cfd6ff" fillOpacity="0.6" />)}
            <circle cx={d.map.bilbao[0]} cy={d.map.bilbao[1]} r="42" fill="url(#glow)" />
            <circle cx={d.map.bilbao[0]} cy={d.map.bilbao[1]} r="5" fill="#fff" />
          </svg>
          <p className="pointer-events-none absolute right-5 bottom-4 flex items-center gap-1 text-xs text-white/70"><MapPin size={12} /> Bilbao</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label={t("posts")} value={String(d.posts)} sub={t("posts30", { count: d.posts30 })} />
            <Kpi label={t("shareSave")} value={d.shareSave === null ? "—" : pct(d.shareSave, locale)} sub={t("shareSaveSub")} />
            <Kpi label={t("bestFormat")} value={d.bestFormat ?? "—"} sub={t("dms", { count: d.inquiries30 })} />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="panel p-4">
              <p className="text-sm font-medium">{t("whereSales")}</p>
              {d.channels.length ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-40 w-40 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={d.channels} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
                        {d.channels.map((c, i) => <Cell key={c.name} fill={PIE[i % PIE.length]} />)}</Pie></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                    {d.channels.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: PIE[i % PIE.length] }} />
                        <span className="flex-1 truncate">{tc.has(c.name) ? tc(c.name) : c.name}</span><span className="text-muted tabular-nums">{pct(total ? c.value / total : null, locale)}</span></li>
                    ))}
                  </ul>
                </div>
              ) : <p className="mt-6 text-center text-sm text-muted">{t("noSales")}</p>}
            </div>
            <div className="panel p-4">
              <p className="text-sm font-medium">{t("formats")}</p>
              {d.radar.length >= 3 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={d.radar} outerRadius="70%">
                      <PolarGrid stroke="rgb(255 255 255 / 0.12)" />
                      <PolarAngleAxis dataKey="tag" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                      <Radar dataKey="rate" stroke="#ff8a5c" fill="#8b7bff" fillOpacity={0.35} isAnimationActive={false} />
                      <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="glass rounded-xl px-3 py-2 text-xs">{String(payload[0].payload.tag)}: {pct(Number(payload[0].value), locale)}</div> : null} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-6 text-center text-sm text-muted">{t("needThree")}</p>}
            </div>
          </div>

          <div className="panel mt-3 p-4">
            <p className="text-sm font-medium">{t("whatWorks")}</p>
            {d.bubbles.rows.length ? (
              <div className="mt-3 overflow-x-auto">
                <div className="grid min-w-[520px] items-center gap-y-2" style={{ gridTemplateColumns: `110px repeat(${d.bubbles.weeks.length}, minmax(0,1fr))` }}>
                  <span />
                  {d.bubbles.weeks.map((w) => <span key={w} className="text-center text-[10px] text-muted">{shortDate(w, locale)}</span>)}
                  {d.bubbles.rows.map((row, r) => (
                    <div key={row} className="contents">
                      <span className="truncate pr-2 text-xs text-muted">{row}</span>
                      {d.bubbles.weeks.map((w, c) => {
                        const cell = d.bubbles.cells.find((x) => x.r === r && x.c === c);
                        const size = cell ? 14 + (cell.v / maxV) * 26 : 6;
                        return (
                          <span key={w} className="grid h-11 place-items-center">
                            <span className="grid place-items-center rounded-full text-[9px] font-semibold text-white"
                                  style={{ width: size, height: size, background: cell ? "rgb(139 123 255 / 0.55)" : "rgb(255 255 255 / 0.12)", boxShadow: cell ? "inset 0 0 0 1px rgb(180 170 255 / 0.8)" : "none" }}
                                  title={cell ? `${row} · ${cell.v}` : undefined}>{cell && size > 26 ? cell.v : ""}</span>
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="mt-6 text-center text-sm text-muted">{t("noPosts")}</p>}
          </div>
        </section>
        <p className="text-xs text-muted">{t("revenueNote", { amount: eur(total, locale) })}</p>
      </div>

      {/* AI panel on the right (like "Fuse AI") */}
      <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">{assistant}</aside>
    </div>
  );
}
