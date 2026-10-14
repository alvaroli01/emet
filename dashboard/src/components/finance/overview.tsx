"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Info } from "lucide-react";
import { eur, pct } from "@/lib/format";
import { GOAL, START, DEADLINE, weekStart } from "@/lib/metrics";
import { summary, inRange, cashExpected, byMethod, sumBy, breakEven, wowGrowth, costToWin, type SaleRow, type ExpenseRow, type Project } from "@/lib/finance";

type Range = "week" | "month" | "all" | "custom";
const DONUT = ["#2b6ca3", "#c9502e", "#2f8a5a", "#b7791f", "#5b4ba8", "#8a5a7a", "#59625b"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

const KEY_CARDS = ["revenue", "net", "netMargin", "cash", "orders", "breakEven"];
/** Key cards first in this order, the rest after them in their usual order */
const rank = (k: string) => { const i = KEY_CARDS.indexOf(k); return i === -1 ? 100 : i; };
export function FinanceOverview({ sales, expenses, projects, members, customersWon, today }: {
  sales: SaleRow[]; expenses: ExpenseRow[]; projects: Project[]; members: number; customersWon: number; today: string;
}) {
  const t = useTranslations("finance");
  const tc = useTranslations("tools.categories");
  const locale = useLocale();
  const [range, setRange] = useState<Range>("month");
  const [allCards, setAllCards] = useState(false);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);

  const [f, tt] = useMemo<[string | null, string | null]>(() => {
    if (range === "week") return [weekStart(Date.parse(today + "T12:00:00Z")), today];
    if (range === "month") return [today.slice(0, 8) + "01", today];
    if (range === "custom") return [from || null, to || null];
    return [null, null];
  }, [range, from, to, today]);

  const s = inRange(sales, f, tt), e = inRange(expenses, f, tt);
  const sum = summary(s, e);
  const monthS = inRange(sales, today.slice(0, 8) + "01", today), monthE = inRange(expenses, today.slice(0, 8) + "01", today);
  const budget = projects.reduce((a, p) => a + (Number(p.budget) || 0), 0);
  const wow = wowGrowth(sales, today);
  const cards: { key: string; value: string; tone?: "ok" | "warn" | "bad" }[] = [
    { key: "revenue", value: eur(sum.revenue, locale) },
    { key: "gross", value: eur(sum.gross, locale) },
    { key: "grossMargin", value: pct(sum.grossMargin, locale), tone: sum.grossMargin === null ? undefined : sum.grossMargin >= GOAL.minMargin ? "ok" : "bad" },
    { key: "net", value: eur(sum.net, locale), tone: sum.net >= 0 ? undefined : "bad" },
    { key: "netMargin", value: pct(sum.netMargin, locale), tone: sum.netMargin === null ? undefined : sum.netMargin >= GOAL.minMargin ? "ok" : "warn" },
    { key: "cash", value: eur(cashExpected(sales, expenses), locale) },
    { key: "aov", value: sum.aov === null ? "—" : eur(sum.aov, locale) },
    { key: "orders", value: String(sum.orders) },
    { key: "units", value: String(sum.units) },
    { key: "wow", value: wow === null ? "—" : `${wow >= 0 ? "+" : ""}${pct(wow, locale)}`, tone: wow === null ? undefined : wow >= 0 ? "ok" : "warn" },
    { key: "perMember", value: eur(members ? sum.revenue / members : 0, locale) },
    { key: "vsBudget", value: budget ? `${eur(sum.expenses, locale)} / ${eur(budget, locale)}` : "—", tone: budget && sum.expenses > budget ? "bad" : undefined },
    { key: "costToWin", value: (() => { const c = costToWin(e, customersWon); return c === null ? "—" : eur(c, locale); })() },
    { key: "breakEven", value: (() => { const b = breakEven(monthS, monthE); return b === 0 ? t("cards.covered") : eur(b, locale); })(), tone: breakEven(monthS, monthE) === 0 ? "ok" : "warn" },
  ];

  // Waterfall: revenue → minus cost of goods → minus expenses → net profit
  // Floating bars: each step is a [from, to] range, so costs visibly "fall" from revenue down to net profit
  const waterfall = [
    { name: t("wf.revenue"), range: [0, sum.revenue], amount: sum.revenue, fill: "var(--series-1)" },
    { name: t("wf.cogs"), range: [sum.gross, sum.revenue], amount: -sum.cogs, fill: "var(--bad)" },
    { name: t("wf.expenses"), range: [sum.net, sum.gross], amount: -sum.expenses, fill: "var(--warn)" },
    { name: t("wf.net"), range: [Math.min(0, sum.net), Math.max(0, sum.net)], amount: sum.net, fill: sum.net >= 0 ? "var(--ok)" : "var(--bad)" },
  ];
  const donut = sumBy(e, (x) => x.category ?? "other", (x) => Number(x.amount)).filter((x) => x.value > 0);
  const methods = byMethod(s, e).filter((m) => m.in || m.out);
  const channels = sumBy(s, (x) => x.channel?.trim() || t("noChannel"), (x) => Number(x.amount)).filter((x) => x.value > 0);

  // Weekly revenue & profit + running total vs the even pace to €30K (the Summit)
  const series = useMemo(() => {
    const weeks: string[] = [];
    for (let w = Date.parse(weekStart(Date.parse(START + "T12:00:00Z")) + "T12:00:00Z"); w <= Date.parse(today + "T12:00:00Z"); w += 7 * 864e5) weeks.push(iso(new Date(w)));
    const total = (Date.parse(DEADLINE) - Date.parse(START)) / 864e5;
    let cum = 0;
    return weeks.slice(-16).map((wk) => {
      const end = iso(new Date(Date.parse(wk + "T12:00:00Z") + 6 * 864e5));
      const r = summary(inRange(sales, wk, end), inRange(expenses, wk, end));
      cum = summary(inRange(sales, null, end), []).revenue;
      const elapsed = Math.max(0, (Date.parse(end) - Date.parse(START)) / 864e5);
      return { week: new Date(wk + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short" }), revenue: r.revenue, profit: r.net, cum, pace: Math.round((GOAL.revenue * elapsed) / total) };
    });
  }, [sales, expenses, today, locale]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-surface-2 p-1 text-sm" role="tablist" aria-label={t("range.label")}>
          {(["week", "month", "all", "custom"] as const).map((r) => (
            <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)}
                    className={`rounded-lg px-3 py-1.5 transition ${range === r ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"}`}>{t(`range.${r}`)}</button>
          ))}
        </div>
        {range === "custom" && (
          <span className="flex items-center gap-1.5 text-sm">
            <input type="date" value={from} onChange={(e2) => setFrom(e2.target.value)} className="input w-auto py-1.5" aria-label={t("range.from")} />
            <span className="text-muted">→</span>
            <input type="date" value={to} onChange={(e2) => setTo(e2.target.value)} className="input w-auto py-1.5" aria-label={t("range.to")} />
          </span>
        )}
      </div>

      {/* The 6 numbers people check daily first; the other 8 on demand, so the page doesn't open on a wall of cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[...cards].sort((a, b) => rank(a.key) - rank(b.key)).filter((c) => allCards || KEY_CARDS.includes(c.key))
          .map((c) => <MetricCard key={c.key} label={t(`cards.${c.key}`)} value={c.value} explain={t(`explain.${c.key}`)} tone={c.tone} />)}
      </div>
      <button onClick={() => setAllCards((v) => !v)} aria-expanded={allCards}
              className="mx-auto flex min-h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-medium shadow-[var(--shadow)] ring-1 ring-line hover:bg-surface-2">
        {allCards ? t("showFewer") : t("showAll", { count: cards.length - KEY_CARDS.length })}
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel title={t("charts.waterfall")}>
          {sum.revenue || sum.expenses ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={waterfall} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => eur(v, locale)} />
                <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => active && payload?.[0] ? (
                  <div className="panel px-3 py-2 text-xs"><p className="font-medium">{String(payload[0].payload.name)}</p><p className="tabular-nums">{eur(Number(payload[0].payload.amount), locale)}</p></div>) : null} />
                <Bar dataKey="range" radius={6}>{waterfall.map((w) => <Cell key={w.name} fill={w.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text={t("emptySales")} />}
        </Panel>
        <Panel title={t("charts.margin")}><Gauge value={sum.grossMargin} label={t("cards.grossMargin")} target={GOAL.minMargin} targetLabel={t("min50")} /></Panel>
      </div>

      <Panel title={t("charts.overTime")}>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <YAxis yAxisId="w" tickLine={false} axisLine={false} width={56} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => eur(v, locale)} />
            <YAxis yAxisId="c" orientation="right" tickLine={false} axisLine={false} width={64} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => eur(v, locale)} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <div className="panel px-3 py-2 text-xs"><p className="mb-1 font-medium">{label}</p>
                {payload.map((p) => <p key={String(p.dataKey)} className="tabular-nums"><span style={{ color: String(p.color) }}>●</span> {t(`series.${String(p.dataKey)}`)}: {eur(Number(p.value), locale)}</p>)}</div>) : null} />
            <Bar yAxisId="w" dataKey="revenue" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="w" dataKey="profit" fill="var(--series-2)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="c" dataKey="cum" stroke="var(--climbed)" strokeWidth={2.5} dot={false} />
            <Line yAxisId="c" dataKey="pace" stroke="var(--muted)" strokeDasharray="5 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {(["revenue", "profit", "cum", "pace"] as const).map((k) => <span key={k}><span style={{ color: { revenue: "var(--series-1)", profit: "var(--series-2)", cum: "var(--climbed)", pace: "var(--muted)" }[k] }}>{k === "pace" ? "╌" : "●"}</span> {t(`series.${k}`)}</span>)}
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t("charts.expenses")}>
          {donut.length ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart><Pie data={donut} dataKey="value" nameKey="key" innerRadius={42} outerRadius={66} paddingAngle={2} stroke="none">
                  {donut.map((d, i) => <Cell key={d.key} fill={DONUT[i % DONUT.length]} />)}</Pie></PieChart>
              </ResponsiveContainer>
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {donut.map((d, i) => (
                  <li key={d.key} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-sm" style={{ background: DONUT[i % DONUT.length] }} />
                    <span className="flex-1 truncate">{tc.has(d.key) ? tc(d.key) : d.key}</span><span className="tabular-nums text-muted">{eur(d.value, locale)}</span></li>
                ))}
              </ul>
            </div>
          ) : <Empty text={t("emptyExpenses")} />}
        </Panel>
        <Panel title={t("charts.methods")}>
          {methods.length ? <HBars rows={methods.map((m) => ({ label: t(`ledgers.methods.${m.method}`), value: m.in }))} locale={locale} /> : <Empty text={t("emptySales")} />}
        </Panel>
        <Panel title={t("charts.channels")}>
          {channels.length ? <HBars rows={channels.map((c) => ({ label: c.key, value: c.value }))} locale={locale} /> : <Empty text={t("emptySales")} />}
        </Panel>
      </div>

      <Panel title={t("charts.calendar")}><Heatmap sales={sales} today={today} locale={locale} /></Panel>
    </div>
  );
}

export function MetricCard({ label, value, explain, tone }: { label: string; value: string; explain: string; tone?: "ok" | "warn" | "bad" }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="panel panel-lift p-3.5 text-left">
      <span className="flex items-start justify-between gap-1 text-xs text-muted">{label}<Info size={12} className="mt-0.5 shrink-0 opacity-50" /></span>
      <span className={`readout mt-1 block text-xl ${tone === "ok" ? "text-ok-text" : tone === "bad" ? "text-bad-text" : tone === "warn" ? "text-warn-text" : ""}`}>{value}</span>
      {open && <span className="mt-1.5 block text-xs leading-relaxed text-muted">{explain}</span>}
    </button>
  );
}

export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="panel min-w-0 p-5">
      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{title}</h3>{action}</div>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="grid h-32 place-items-center rounded-xl border border-dashed border-line px-4 text-center text-sm text-muted">{text}</p>;
}

export function HBars({ rows, locale }: { rows: { label: string; value: number }[]; locale: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between gap-2"><span className="truncate">{r.label}</span><span className="tabular-nums text-muted">{eur(r.value, locale)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-series-1" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Gauge({ value, label, target, targetLabel }: { value: number | null; label: string; target: number; targetLabel: string }) {
  const locale = useLocale();
  const v = Math.max(0, Math.min(1, value ?? 0));
  const R = 70, cx = 90, cy = 84;
  const pt = (f: number) => [cx - R * Math.cos(Math.PI * f), cy - R * Math.sin(Math.PI * f)];
  // A half circle never spans more than 180°, so the large-arc flag is always 0
  const arc = (f: number) => { const [x, y] = pt(f); return `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${x} ${y}`; };
  const [tx, ty] = pt(target);
  const ok = value !== null && value >= target;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" className="w-full max-w-[260px]" role="img" aria-label={`${label}: ${pct(value, locale)}`}>
        <path d={arc(1)} fill="none" stroke="var(--surface-2)" strokeWidth="14" strokeLinecap="round" />
        {value !== null && v > 0 && <path d={arc(v)} fill="none" stroke={ok ? "var(--ok)" : "var(--warn)"} strokeWidth="14" strokeLinecap="round" />}
        <line x1={tx} y1={ty} x2={cx + (tx - cx) * 1.22} y2={cy + (ty - cy) * 1.22} stroke="var(--text)" strokeWidth="2" />
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-ink" style={{ fontSize: 24, fontWeight: 650 }}>{pct(value, locale)}</text>
      </svg>
      <p className="mt-1 text-xs text-muted">▏{targetLabel}</p>
    </div>
  );
}

function Heatmap({ sales, today, locale }: { sales: SaleRow[]; today: string; locale: string }) {
  const t = useTranslations("finance");
  const byDay = new Map<string, number>();
  for (const s of sales) byDay.set(s.date, (byDay.get(s.date) ?? 0) + Number(s.amount));
  const end = Date.parse(today + "T12:00:00Z");
  const startMonday = Date.parse(weekStart(end - 15 * 7 * 864e5) + "T12:00:00Z");
  const days: { d: string; v: number; col: number; row: number }[] = [];
  for (let x = startMonday, i = 0; x <= end; x += 864e5, i++) { const d = iso(new Date(x)); days.push({ d, v: byDay.get(d) ?? 0, col: Math.floor(i / 7), row: i % 7 }); }
  const max = Math.max(...days.map((d) => d.v), 1);
  const cols = Math.max(...days.map((d) => d.col)) + 1;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${cols * 16 + 24} ${7 * 16}`} className="h-[124px] min-w-[300px]" role="img" aria-label={t("charts.calendar")}>
        {[0, 2, 4].map((r) => <text key={r} x={0} y={r * 16 + 11} style={{ fontSize: 9 }} className="fill-muted">{new Date(Date.UTC(2026, 9, 12 + r)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }).slice(0, 2)}</text>)}
        {days.map((d) => (
          <rect key={d.d} x={24 + d.col * 16} y={d.row * 16} width={13} height={13} rx={3}
                fill={d.v > 0 ? `color-mix(in srgb, var(--climbed) ${20 + (d.v / max) * 80}%, var(--surface-2))` : "var(--surface-2)"}>
            <title>{`${new Date(d.d + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}: ${eur(d.v, locale)}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
