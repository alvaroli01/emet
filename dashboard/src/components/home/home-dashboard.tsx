"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Search, PenLine, CalendarDays, Plus, FileText, Receipt, Trophy, Coins, Target, ArrowUp, ChevronLeft, ChevronRight, Loader2, Users, Store, GraduationCap, ArrowUpRight } from "lucide-react";
import { Avatar } from "@/components/ui";
import { POINT_KINDS, POINT_GOALS, type PointKind } from "@/lib/points";
import type { Period, Series, Unit } from "@/lib/today-periods";
import { MountainLazy } from "@/components/summit/mountain-lazy";
import { GroupIcon } from "@/components/group-icon";
import { NumberTicker } from "@/components/ui/number-ticker";
import { eur } from "@/lib/format";
import { WeekCalendar, type CalendarItem } from "@/components/home/week-calendar";

export type HomeData = {
  name: string;
  weekLabel: string;
  canLogSale: boolean;
  sales: { week: number; count: number; rows: { label: string; days: number[] }[] };
  meId: string;
  points: Record<PointKind, number>;
  activity: { active: number; total: number; days: number[]; top: { id: string; name: string; avatar: string | null; n: number }[]; quiet: { id: string; name: string; avatar: string | null }[] };
  money: { days: number[]; week: number };
  goal: { revenue: number; goal: number; pct: number; daysLeft: number; nextCampAt: number | null; teams: { slug: string; color: string; label: string; mine: boolean }[] };
  team: { late: number; blockers: number };
  focus: { score: number | null; dueToday: number; late: number; doneWeek: number };
  calendar: { today: string; days: string[]; items: CalendarItem[] };
};

const POINT_ICON = { community: Users, visit: Store, learning: GraduationCap } as const;

/** Things the team did per day this week (from the activity log); today in orange. */
function ActivityBars({ days, labels, today, label }: { days: number[]; labels: string[]; today: number; label: string }) {
  const max = Math.max(1, ...days);
  return (
    <div className="mt-2 grid grid-cols-7 gap-1.5" role="img" aria-label={label}>
      {days.map((n, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-full items-end rounded-md bg-white/5">
            <div className={`w-full rounded-md ${i === today ? "bg-[#ff7a2e]" : "bg-white/35"}`} style={{ height: `${n ? Math.max(8, (n / max) * 100) : 0}%` }} />
          </div>
          <span className="text-[10px] text-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** One glass card with the round icon chip and a "Last 7 days" style note — the building block of Home. */
function Card({ icon, title, note, children, className = "" }: { icon: React.ReactNode; title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel flex min-w-0 flex-col p-4 sm:p-5 ${className}`}>
      <header className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-3 text-[17px] font-medium">
          <span aria-hidden className="grid size-11 place-items-center rounded-2xl text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]" style={{ background: "linear-gradient(145deg, #3a3a40, #1c1c20)" }}>{icon}</span>
          {title}
        </h2>
        {note && <span className="text-xs text-muted">{note}</span>}
      </header>
      {children}
    </section>
  );
}

/** Days of the week in the viewer's language (Monday first), one letter or short. */
function useWeekdays(style: "narrow" | "short" = "narrow") {
  const locale = useLocale();
  return useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: style, timeZone: "UTC" })), [locale, style]);
}

/** Sales by channel: orange pills on a day grid (like the activity strip). */
function ChannelStrip({ rows, labels }: { rows: { label: string; days: number[] }[]; labels: string[] }) {
  const days = labels;
  const cols = { gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` };
  const max = Math.max(1, ...rows.flatMap((r) => r.days));
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 text-[11px] text-muted">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <span className="text-right">{r.label}</span>
          <div className="grid h-4 items-center gap-1" style={cols}>
            {r.days.map((v, i) => <span key={i} title={`${days[i]}: ${v}`} className="mx-auto h-4 rounded-[4px] bg-[#ff7a2e]" style={{ width: v ? `${30 + (v / max) * 70}%` : 0, opacity: v ? 0.55 + (v / max) * 0.45 : 0 }} />)}
          </div>
        </div>
      ))}
      <span />
      <div className="grid text-center" style={cols}>{days.map((d, i) => <span key={i} className="truncate">{d}</span>)}</div>
    </div>
  );
}

/** Money per day as stacked yellow blocks (like the heart-rate columns). */
function BlockColumns({ values, labels }: { values: number[]; labels: string[] }) {
  const days = labels;
  const max = Math.max(1, ...values);
  return (
    <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
      {values.map((v, i) => {
        const filled = v ? Math.max(1, Math.round((v / max) * 6)) : 0;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="flex h-24 w-full flex-col-reverse gap-[3px]" title={`${days[i]}: ${v}`}>
              {Array.from({ length: 6 }, (_, k) => <span key={k} className={`h-full rounded-[4px] ${k < filled ? "bg-[#ffc23d] shadow-[0_0_10px_rgb(255_194_61/0.35)]" : "bg-surface-2"}`} />)}
            </div>
            <span className="text-[10px] text-muted">{days[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Speedometer-style gauge: tick marks around a half circle, filled up to the goal %. */
function Gauge({ pct, label, small = false }: { pct: number; label: string; small?: boolean }) {
  const ticks = 46;
  return (
    <div className={`relative w-full ${small ? "max-w-[170px]" : "mx-auto max-w-[260px]"}`}>
      <svg viewBox="0 0 200 112" className="w-full" aria-hidden>
        {Array.from({ length: ticks }, (_, i) => {
          const f = i / (ticks - 1), a = Math.PI * (1 - f);
          const r1 = 84, r2 = i % 5 === 0 ? 70 : 75;
          const on = f <= pct;
          const r = (v: number) => Math.round(v * 100) / 100;
          return <line key={i} x1={r(100 + r1 * Math.cos(a))} y1={r(100 - r1 * Math.sin(a))} x2={r(100 + r2 * Math.cos(a))} y2={r(100 - r2 * Math.sin(a))}
                       stroke={on ? "#ffffff" : "rgb(255 255 255 / 0.28)"} strokeWidth={i % 5 === 0 ? 3 : 2} strokeLinecap="round" />;
        })}
        {(() => { const a = Math.PI * (1 - pct); return <line x1="100" y1="100" x2={Math.round((100 + 60 * Math.cos(a)) * 100) / 100} y2={Math.round((100 - 60 * Math.sin(a)) * 100) / 100} stroke="#ff6a1a" strokeWidth="3" strokeLinecap="round" />; })()}
        <circle cx="100" cy="100" r="5" fill="#ff6a1a" />
      </svg>
      <p className={`absolute inset-x-0 top-[34%] text-center text-white/90 ${small ? "text-[9px]" : "text-[11px]"}`}>{label}</p>
      <p className={`readout absolute inset-x-0 top-[50%] text-center text-white ${small ? "text-2xl" : "text-4xl"}`}>{Math.round(pct * 100)}%</p>
    </div>
  );
}

/**
 * Types a line, waits, deletes it and types the next — a looping placeholder for the ask box (decoration only).
 * With reduced motion it simply shows the first line.
 */
function useTypewriter(lines: string[], paused: boolean) {
  const [text, setText] = useState(lines[0] ?? "");
  useEffect(() => {
    if (paused || lines.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let line = 0, len = lines[0].length, deleting = true, timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const full = lines[line];
      if (deleting) {
        len--;
        if (len <= 0) { deleting = false; line = (line + 1) % lines.length; len = 0; }
      } else {
        len++;
        if (len >= lines[line].length) { setText(lines[line]); deleting = true; timer = setTimeout(step, 2200); return; }
      }
      setText((deleting ? full : lines[line]).slice(0, Math.max(0, len)));
      timer = setTimeout(step, deleting ? 28 : 55 + Math.random() * 45);
    };
    timer = setTimeout(step, 2600);
    return () => clearTimeout(timer);
  }, [lines, paused]);
  return text;
}

/** Home: the Bilbao-at-night page — ask box on top, glass cards at the bottom (from the "home page example"). */
export function HomeDashboard({ d }: { d: HomeData }) {
  const t = useTranslations("home");
  const tp = useTranslations("points");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const examples = useMemo(() => [t("askPlaceholder"), ...(t.raw("askExamples") as string[])], [t]);
  const typed = useTypewriter(examples, q.length > 0);
  const ask = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) { window.dispatchEvent(new CustomEvent("emet:ask", { detail: q.trim() })); setQ(""); } };

  // Sales / Tasks / Money cards: this week by default; Week | Month and ‹ › choose another period
  const weekdays = useWeekdays();
  const [unit, setUnit] = useState<Unit>("week");
  const [offset, setOffset] = useState(0);
  const [live, setLive] = useState<{ period: Period; series: Series } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (unit === "week" && offset === 0) { setLive(null); return; }
    let alive = true;
    setBusy(true);
    fetch(`/api/today/cards?unit=${unit}&offset=${offset}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) { setLive(j); setBusy(false); } }).catch(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [unit, offset]);
  const fmt = (x: string, o: Intl.DateTimeFormatOptions) => new Date(x + "T12:00:00Z").toLocaleDateString(locale, { ...o, timeZone: "UTC" });
  const view = live ? {
    label: live.period.unit === "month" ? fmt(live.period.from, { month: "long", year: "numeric" }) : `${fmt(live.period.from, { day: "numeric", month: "short" })} – ${fmt(live.period.to, { day: "numeric", month: "short" })}`,
    labels: live.period.unit === "month" ? live.period.buckets.map((b) => `${Number(b.start.slice(8))}–${Number(b.end.slice(8))}`) : weekdays,
    note: live.period.unit === "month" ? fmt(live.period.from, { month: "short" }) : t("week"),
    future: live.period.future,
    sales: { week: live.series.moneyTotal, count: live.series.salesCount, rows: (["stall", "online", "other"] as const).map((k, i) => ({ label: d.sales.rows[i]?.label ?? k, days: live.series.channels[k] })) },
    money: { days: live.series.money, week: live.series.moneyTotal },
  } : { label: d.weekLabel, labels: weekdays, note: t("last7"), future: false, sales: d.sales, money: d.money };
  const switchUnit = (u: Unit) => { setUnit(u); setOffset(0); };

  return (
    <div className="fade-in flex min-h-[calc(100dvh-5rem)] flex-col">
      {/* Ask box — "Hey, need help? / Just ask me anything" */}
      <form id="ask" onSubmit={ask} className="mx-auto w-full max-w-2xl pt-2 text-center sm:pt-6">
        <p className="text-lg font-medium text-white sm:text-xl">{t("needHelp", { name: d.name })} <span aria-hidden>🙋</span></p>
        <label htmlFor="home-ask" className="sr-only">{t("askLabel")}</label>
        <div className="relative mt-1">
          {!q && (
            <p aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-[clamp(1.6rem,4vw,2.6rem)] font-normal tracking-tight text-white">
              <span className="truncate">{typed}</span><span className="ml-0.5 inline-block h-[0.9em] w-[3px] animate-pulse rounded-full bg-brand" />
            </p>
          )}
          <input id="home-ask" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("askLabel")} autoComplete="off"
                 className="w-full bg-transparent text-center text-[clamp(1.6rem,4vw,2.6rem)] font-light tracking-tight text-white caret-[#ff6a1a] outline-none focus-visible:outline-none" />
          {q && <button aria-label={t("askSend")} className="absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-brand text-white"><ArrowUp size={18} /></button>}
        </div>
      </form>

      <div className="min-h-[18vh] flex-1" />

      {/* Glass pill controls */}
      <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:justify-end sm:px-0">
        <button onClick={() => window.dispatchEvent(new Event("emet:palette"))} aria-label={t("search")} className="glass-pill size-11 shrink-0 justify-center text-white"><Search size={17} /></button>
        <Link href="/board" aria-label={t("newTask")} className="glass-pill size-11 shrink-0 justify-center text-white"><PenLine size={17} /></Link>
        <span className="glass-pill h-11 shrink-0 gap-1 px-1.5 text-sm text-white" role="group" aria-label={t("period")}>
          <span className="flex rounded-full bg-white/10 p-0.5 text-xs">
            {(["week", "month"] as const).map((u) => <button key={u} type="button" onClick={() => switchUnit(u)} aria-pressed={unit === u}
              className={`rounded-full px-2.5 py-1 ${unit === u ? "bg-white font-medium text-black" : "text-white/80"}`}>{t(u === "week" ? "week" : "month")}</button>)}
          </span>
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label={t("prevPeriod")} className="grid size-8 place-items-center rounded-full hover:bg-white/10"><ChevronLeft size={16} /></button>
          <span className="flex min-w-[7.5rem] items-center justify-center gap-1.5 whitespace-nowrap">{busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={15} />} {view.label}</span>
          <button type="button" onClick={() => setOffset((o) => o + 1)} disabled={offset >= (unit === "week" ? 8 : 3)} aria-label={t("nextPeriod")} className="grid size-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30"><ChevronRight size={16} /></button>
        </span>
        {d.canLogSale && <Link href="/g/finance?tab=books" className="glass-pill h-11 shrink-0 px-4 text-sm text-white"><Plus size={16} /> {t("logSale")}</Link>}
        <Link href="/today#report" className="glass-pill h-11 shrink-0 px-4 text-sm text-white"><FileText size={16} /> {t("report")}</Link>
      </div>

      {/* Glass cards */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)] lg:gap-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          <Card icon={<Receipt size={19} />} title={t("sales")} note={view.note}>
            <ChannelStrip rows={view.sales.rows} labels={view.labels} />
            <p className="readout mt-3 text-3xl"><NumberTicker value={Math.round(view.sales.week)} locale={locale} options={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }} /></p>
            <p className="text-xs text-muted">{view.future ? t("notYet") : t(live ? "salesCountPeriod" : "salesCount", { count: view.sales.count })}</p>
          </Card>
          {/* My points: everyone's goal for June 2027, one bar per kind; the full list is on my member page */}
          <Card icon={<Trophy size={19} />} title={t("myPoints")}>
            <ul className="mt-3 space-y-2.5">
              {POINT_KINDS.map((k) => {
                const Icon = POINT_ICON[k], done = d.points[k], goal = POINT_GOALS[k];
                return (
                  <li key={k}>
                    <p className="flex items-center gap-1.5 text-xs"><Icon size={13} className="text-muted" /> <span className="flex-1 truncate">{tp(`kinds.${k}`)}</span>
                      <b className="readout">{done}</b><span className="text-muted">/{goal}</span></p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={goal} aria-label={tp(`kinds.${k}`)}>
                      <div className={`h-full rounded-full ${done >= goal ? "bg-ok" : "bg-[#ff7a2e]"}`} style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto flex items-end justify-between gap-2 pt-3">
              <p className="readout text-3xl">{POINT_KINDS.reduce((a, k) => a + d.points[k], 0)} <span className="text-base font-normal text-muted">{t("pointsTotal")}</span></p>
              <Link href={`/team/${d.meId}`} className="-mr-2 flex min-h-9 items-center gap-0.5 px-2 text-xs font-medium text-muted hover:text-ink">{t("seeAll")} <ArrowUpRight size={13} /></Link>
            </div>
          </Card>
          <Card icon={<Coins size={19} />} title={t("money")} note={view.note} className="sm:col-span-2 lg:col-span-1">
            <BlockColumns values={view.money.days} labels={view.labels} />
            <p className="readout mt-2 text-3xl">{eur(view.money.week, locale)}</p>
            <p className="flex items-center gap-1 text-xs text-muted"><span className="text-[#ff7a2e]">●</span> {t("moneyNote")}</p>
          </Card>

          {/* Team this week: who's in, who to check on, what's stuck */}
          <section className="panel flex flex-col p-4 sm:col-span-2 sm:p-5 lg:col-span-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-medium">{t("teamWeek")}</h2>
              <p className="text-xs text-muted"><b className="readout text-base text-ink">{d.activity.active}</b>/{d.activity.total} {t("activeWeek")}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/" className={`rounded-2xl px-3 py-2 transition-[filter] hover:brightness-125 ${d.team.late ? "bg-bad/15 text-bad-text" : "bg-surface-2"}`}>
                <p className="readout text-xl">{d.team.late}</p><p className="text-xs">{t("lateTasks")}</p>
              </Link>
              <Link href="/" className={`rounded-2xl px-3 py-2 transition-[filter] hover:brightness-125 ${d.team.blockers ? "bg-bad/15 text-bad-text" : "bg-surface-2"}`}>
                <p className="readout text-xl">{d.team.blockers}</p><p className="text-xs">{t("blockers")}</p>
              </Link>
            </div>
            <ActivityBars days={d.activity.days} labels={weekdays} today={d.calendar.days.indexOf(d.calendar.today)}
                          label={t("activityAria", { days: d.activity.days.map((n, i) => `${weekdays[i]} ${n}`).join(", ") })} />
            {d.activity.top.length > 0 && (
              <>
                <h3 className="mt-3 text-xs font-medium text-muted">{t("mostActive")}</h3>
                <ul className="mt-1.5 space-y-1.5">
                  {d.activity.top.map((p, i) => (
                    <li key={p.id}>
                      <Link href={`/team/${p.id}`} className="flex items-center gap-2 text-sm hover:text-link">
                        <span className="w-3 text-xs text-muted">{i + 1}</span>
                        <Avatar name={p.name} src={p.avatar} size={22} />
                        <span className="flex-1 truncate">{p.name.split(" ")[0]}</span>
                        <span className="readout text-xs text-muted">{t("actions", { count: p.n })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="mt-3 text-xs font-medium text-muted">{t("notSeen")}</h3>
            {d.activity.quiet.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {d.activity.quiet.map((p) => (
                  <Link key={p.id} href={`/team/${p.id}`} title={p.name} aria-label={p.name} className="rounded-full ring-1 ring-line transition-shadow hover:ring-2 hover:ring-brand">
                    <Avatar name={p.name} src={p.avatar} size={36} />
                  </Link>
                ))}
              </div>
            ) : <p className="mt-1 text-sm text-ok-text">{t("allSeen")}</p>}
          </section>

          <section className="panel p-4 sm:col-span-2 sm:p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-medium">{t("emetCalendar")}</h2>
              <div className="flex items-center gap-1.5 text-xs">
                {d.focus.score !== null && <span className="rounded-full bg-surface-2 px-2.5 py-1">{t("focusScore")} <b className="readout text-[#ff7a2e]">{d.focus.score}</b></span>}
                <span className="rounded-full bg-surface-2 px-2.5 py-1">{t("dueToday")} <b className="readout">{d.focus.dueToday}</b></span>
                {d.focus.late > 0 && <span className="rounded-full bg-bad/20 px-2.5 py-1 text-bad-text">{t("late")} <b className="readout">{d.focus.late}</b></span>}
                <Link href="/camp#week" className="rounded-full bg-surface-2 px-2.5 py-1 font-medium hover:text-link">{t("myWeekCamp")}</Link>
                <Link href="/camp?tab=agenda#camp-tabs" className="rounded-full bg-surface-2 px-2.5 py-1 font-medium hover:text-link">{t("scheduleOpen")}</Link>
              </div>
            </div>
            <WeekCalendar days={d.calendar.days} today={d.calendar.today} items={d.calendar.items} />
          </section>
        </div>

        {/* Goal: the 3D mountain with coins behind a speed-style gauge, teams on top */}
        <section className="panel relative isolate min-h-[420px] overflow-hidden p-4 sm:p-5">
          <div className="absolute inset-0 -z-10 opacity-90">
            <MountainLazy className="size-full" variant="money" progress={d.goal.pct} nextCampAt={d.goal.nextCampAt} ariaLabel={t("goalAria", { pct: Math.round(d.goal.pct * 100) })}
                          labels={{ summit: eur(d.goal.goal, locale), here: d.goal.revenue > 0 ? eur(d.goal.revenue, locale) : null }} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/80" />
          </div>
          <div className="flex justify-center gap-1.5">
            {d.goal.teams.map((g) => (
              <Link key={g.slug} href={`/g/${g.slug}`} title={g.label} aria-label={g.label}
                    className={`glass-pill grid place-items-center text-white transition hover:brightness-125 ${g.mine ? "size-12 ring-2 ring-white/60" : "size-10"}`}>
                <GroupIcon slug={g.slug} size={g.mine ? 19 : 16} />
              </Link>
            ))}
          </div>
          {/* Gauge sits in the corner so the mountain stays visible in the middle */}
          <div className="pointer-events-none absolute bottom-20 left-3 w-[170px] rounded-3xl bg-black/35 p-2 backdrop-blur-md">
            <Gauge pct={d.goal.pct} label={t("toSummit")} small />
          </div>
          <div className="pointer-events-none absolute inset-x-4 bottom-5 text-left">
            <p className="flex items-center gap-1.5 text-lg font-medium text-white"><Target size={17} /> {eur(d.goal.revenue, locale)} <span className="text-white/80">/ {eur(d.goal.goal, locale)}</span></p>
            <p className="mt-0.5 text-xs text-white/85">{t("daysLeft", { count: d.goal.daysLeft })}</p>
          </div>
        </section>
      </div>
      <p className="mt-3 text-right text-[10px] text-white/65">{t("photoCredit")}</p>
    </div>
  );
}
