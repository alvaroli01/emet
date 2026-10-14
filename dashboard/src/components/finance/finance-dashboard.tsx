"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Sankey, Layer, Rectangle } from "recharts";
import { Plus, ArrowUpRight, ArrowDownLeft, Lock, Banknote, Smartphone, CreditCard, Landmark, ArrowUp, ArrowDown, FolderPlus } from "lucide-react";
import { eur, pct, shortDate } from "@/lib/format";
import type { FinanceDash } from "@/lib/finance-dash";

const METHOD_ICON = { cash: Banknote, bizum: Smartphone, card: CreditCard, transfer: Landmark } as const;

function Change({ v }: { v: number | null }) {
  const locale = useLocale();
  if (v === null) return null;
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${up ? "bg-ok/15 text-ok-text" : "bg-bad/15 text-bad-text"}`}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{pct(Math.abs(v), locale)}
    </span>
  );
}

function Spark({ values, up }: { values: number[]; up: boolean }) {
  const max = Math.max(1, ...values), W = 90, H = 30;
  const d = values.map((v, i) => `${i ? "L" : "M"} ${(i / (values.length - 1)) * W} ${H - (v / max) * H}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-24" aria-hidden><path d={d} fill="none" stroke={up ? "var(--ok)" : "var(--bad)"} strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

/** Finance at a glance — modelled on the "finance example": total, methods, money over time, flow, cashflow. */
export function FinanceDashboard({ d, canEdit }: { d: FinanceDash; canEdit: boolean }) {
  const t = useTranslations("financeDash");
  const tm = useTranslations("finance.ledgers.methods");
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const days = d.daily;
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }));
  const maxOut = Math.max(1, ...d.weekOut);
  const heatMax = Math.max(1, ...d.heat.map(Math.abs));
  const nodeLabel = (name: string) => {
    const [kind, key] = name.split(":");
    if (kind === "pay") return tm.has(key) ? tm(key) : key;
    if (kind === "src") return t.has(`sources.${key}`) ? t(`sources.${key}`) : key;
    return key === "none" ? t("noProject") : key;
  };

  return (
    <div className="fade-in space-y-4">
      {/* Header: total + actions */}
      <section className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <p className="text-sm text-muted">{t("totalRevenue")}</p>
          <p className="mt-1 flex items-center gap-2.5">
            <span className="readout text-[clamp(2rem,4.5vw,2.75rem)] leading-none">{eur(d.total, locale, 2)}</span>
            <Change v={d.changePct} />
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>{t("thisMonthIn")}: <span className="text-ink">{eur(d.monthIn, locale)}</span></span>
            <span>{t("thisMonthOut")}: <span className="text-ink">{eur(d.monthOut, locale)}</span></span>
          </p>
        </div>
        {canEdit && (
          <div className="-mx-3 flex w-[calc(100%+1.5rem)] gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:px-0">
            <Link href="/g/finance?tab=books" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_var(--brand)] hover:brightness-110"><Plus size={16} /> {t("logSale")}</Link>
            <Link href="/g/finance?tab=books" className="glass-pill min-h-11 shrink-0 px-4.5 text-sm font-medium"><ArrowUpRight size={16} /> {t("addExpense")}</Link>
            <Link href="/g/finance?tab=books" className="glass-pill min-h-11 shrink-0 px-4.5 text-sm font-medium"><Lock size={15} /> {t("closeMonth")}</Link>
          </div>
        )}
      </section>

      {/* Payment methods */}
      <section aria-label={t("methods")} className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
        {d.methods.map((m) => {
          const Icon = METHOD_ICON[m.key as keyof typeof METHOD_ICON];
          return (
            <div key={m.key} className="panel min-w-[180px] p-4">
              <p className="flex items-center gap-2 text-sm"><span className="grid size-7 place-items-center rounded-lg bg-surface-2"><Icon size={14} /></span>{tm(m.key)}</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className="readout text-2xl leading-none">{eur(m.amount, locale)}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted"><Change v={m.changePct} /> {t("fromLastMonth")}</p>
                </div>
                <Spark values={m.spark} up={(m.changePct ?? 0) >= 0} />
              </div>
            </div>
          );
        })}
        <Link href="/g/finance?tab=projects" className="grid min-w-[180px] place-items-center rounded-[22px] border border-dashed border-line p-4 text-center text-sm text-muted transition hover:border-muted hover:text-ink">
          <span><span className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-surface-2"><FolderPlus size={16} /></span>{t("addProject")}</span>
        </Link>
      </section>

      {/* Money over time + this week's spending */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm text-muted">{t("moneyOverTime")}</p>
              <p className="readout mt-1 text-2xl">{eur(d.in30, locale)} <span className="text-sm font-normal text-muted">{t("last30")}</span></p>
            </div>
            <p className="flex gap-3 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-ink" /> {t("in")}</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand" /> {t("out")}</span></p>
          </div>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} onMouseMove={(s) => setHover(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)} onMouseLeave={() => setHover(null)}>
                <defs>
                  <linearGradient id="finIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--text)" stopOpacity={0.18} /><stop offset="1" stopColor="var(--text)" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="day" hide /><YAxis hide />
                <Tooltip cursor={{ stroke: "var(--border)" }} content={({ active, payload }) => active && payload?.length ? (
                  <div className="glass rounded-xl px-3 py-2 text-xs"><p className="text-muted">{shortDate(String(payload[0].payload.day), locale)}</p>
                    <p>{t("in")}: <b>{eur(Number(payload[0].payload.in), locale)}</b></p><p>{t("out")}: <b>{eur(Number(payload[0].payload.out), locale)}</b></p></div>) : null} />
                <Area type="monotone" dataKey="in" stroke="var(--text)" strokeWidth={2} fill="url(#finIn)" isAnimationActive={false} />
                <Area type="monotone" dataKey="out" stroke="var(--brand)" strokeWidth={2} fill="transparent" isAnimationActive={false} activeDot={{ r: 5, fill: "var(--brand)", stroke: "white" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 hidden grid-cols-[repeat(30,minmax(0,1fr))] gap-1 sm:grid">
            {days.map((x, i) => <span key={x.day} className={`grid h-6 place-items-center rounded-full text-[10px] ${hover === i ? "bg-ink text-bg" : "bg-surface-2 text-muted"}`}>{Number(x.day.slice(8))}</span>)}
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-sm text-muted">{t("spentThisWeek")}</p><p className="readout mt-1 text-2xl">{eur(d.weekOutTotal, locale)}</p></div>
            <Link href="/g/finance?tab=ledgers" className="glass-pill h-8 px-3 text-xs">{t("seeAll")}</Link>
          </div>
          <div className="mt-5 grid h-48 grid-cols-7 items-end gap-2">
            {d.weekOut.map((v, i) => (
              <div key={i} className="flex h-full flex-col items-center gap-2">
                <div className="relative w-full flex-1 overflow-hidden rounded-xl bg-surface-2">
                  <div className={`absolute inset-x-0 bottom-0 rounded-xl ${i === d.todayIdx ? "bg-brand" : "bg-muted/45"}`} style={{ height: `${v ? Math.max(8, (v / maxOut) * 100) : 0}%` }} title={eur(v, locale)} />
                </div>
                <span className={`text-[11px] ${i === d.todayIdx ? "font-semibold text-ink" : "text-muted"}`}>{weekdays[i]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent activity · money flow · net cashflow */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <section className="panel p-5">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">{t("recent")}</p><Link href="/g/finance?tab=ledgers" className="glass-pill h-8 px-3 text-xs">{t("seeAll")}</Link></div>
          {d.recent.length ? (
            <ul className="mt-3 divide-y divide-line">
              {d.recent.map((r) => (
                <li key={r.kind + r.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">{r.kind === "sale" ? <ArrowDownLeft size={15} className="text-ok-text" /> : <ArrowUpRight size={15} className="text-bad-text" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.description}</span><span className="text-xs text-muted">{r.kind === "sale" ? t("sale") : t("expense")} · {shortDate(r.date, locale)}</span></span>
                  <span className={`text-sm font-semibold tabular-nums ${r.amount >= 0 ? "" : "text-muted"}`}>{r.amount >= 0 ? "+" : "−"}{eur(Math.abs(r.amount), locale, 2)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-6 text-center text-sm text-muted">{t("noActivity")}</p>}
        </section>

        <section className="panel p-5">
          <p className="text-sm text-muted">{t("flow")}</p>
          <p className="readout mt-1 text-2xl">{eur(d.total, locale)}</p>
          {d.flow.links.length ? (
            <div className="mt-2 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey data={d.flow} nodePadding={18} iterations={32} nodeWidth={10} margin={{ top: 8, right: 90, bottom: 8, left: 8 }} link={{ stroke: "var(--muted)", strokeOpacity: 0.25 }}
                        node={(p: { x: number; y: number; width: number; height: number; index: number; payload: { name: string } }) => (
                          <Layer key={`n-${p.index}`}>
                            <Rectangle x={p.x} y={p.y} width={p.width} height={Math.max(2, p.height)} fill={p.payload.name.startsWith("pay:") ? "var(--brand)" : "var(--text)"} fillOpacity={0.9} radius={3} />
                            <text x={p.x + p.width + 6} y={p.y + p.height / 2} dy="0.35em" fontSize={11} fill="var(--muted)">{nodeLabel(p.payload.name)}</text>
                          </Layer>
                        )}>
                  <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="glass rounded-xl px-3 py-2 text-xs">{eur(Number(payload[0].value), locale)}</div> : null} />
                </Sankey>
              </ResponsiveContainer>
            </div>
          ) : <p className="mt-6 text-center text-sm text-muted">{t("noActivity")}</p>}
        </section>

        <section className="panel p-5">
          <div className="flex items-start justify-between"><p className="text-sm text-muted">{t("netCashflow")}</p></div>
          <p className={`readout mt-1 text-2xl ${d.net30 < 0 ? "text-bad-text" : ""}`}>{d.net30 < 0 ? "−" : ""}{eur(Math.abs(d.net30), locale)} <span className="text-sm font-normal text-muted">{t("last30")}</span></p>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {d.heat.map((v, i) => (
              <span key={i} title={eur(v, locale)} className="aspect-square rounded-[5px]"
                    style={{ background: v > 0 ? `rgb(255 255 255 / ${0.15 + (v / heatMax) * 0.85})` : v < 0 ? `color-mix(in srgb, var(--brand) ${25 + (Math.abs(v) / heatMax) * 75}%, transparent)` : "var(--surface-2)" }} />
            ))}
          </div>
          <p className="mt-3 flex gap-3 text-[11px] text-muted"><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-white" /> {t("moreIn")}</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-brand" /> {t("moreOut")}</span></p>
        </section>
      </div>
    </div>
  );
}
