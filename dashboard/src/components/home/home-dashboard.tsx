"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Search, PenLine, CalendarDays, Plus, FileText, Receipt, ListChecks, Coins, HeartPulse, Target, ArrowUp, Sparkles } from "lucide-react";
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
  tasks: { thisWeek: number[]; lastWeek: number[]; done: number; delta: number };
  money: { days: number[]; week: number };
  goal: { revenue: number; goal: number; pct: number; daysLeft: number; nextCampAt: number | null; teams: { slug: string; color: string; label: string; mine: boolean }[] };
  health: { score: number | null; onTime: number | null; blockers: number; mood: number | null };
  focus: { score: number | null; dueToday: number; late: number; doneWeek: number };
  calendar: { today: string; days: string[]; items: CalendarItem[] };
};

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
function ChannelStrip({ rows }: { rows: { label: string; days: number[] }[] }) {
  const days = useWeekdays();
  const max = Math.max(1, ...rows.flatMap((r) => r.days));
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 text-[11px] text-muted">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <span className="text-right">{r.label}</span>
          <div className="grid h-4 grid-cols-7 items-center gap-1">
            {r.days.map((v, i) => <span key={i} title={`${days[i]}: ${v}`} className="mx-auto h-4 rounded-[4px] bg-[#ff7a2e]" style={{ width: v ? `${30 + (v / max) * 70}%` : 0, opacity: v ? 0.55 + (v / max) * 0.45 : 0 }} />)}
          </div>
        </div>
      ))}
      <span />
      <div className="grid grid-cols-7 text-center">{days.map((d, i) => <span key={i}>{d}</span>)}</div>
    </div>
  );
}

/** Two step-lines: tasks finished this week (orange) vs last week (lime). */
function StepLines({ a, b }: { a: number[]; b: number[] }) {
  const days = useWeekdays();
  const max = Math.max(4, ...a, ...b);
  const W = 220, H = 92;
  const path = (v: number[]) => v.map((y, i) => { const x = (i / 6) * W, yy = H - (y / max) * H; return i ? `H ${x} V ${yy}` : `M 0 ${yy}`; }).join(" ");
  return (
    <div className="mt-3 flex gap-2">
      <div className="flex flex-col justify-between py-0.5 text-[10px] text-muted">{[max, Math.round(max / 2), 0].map((v) => <span key={v}>{v}</span>)}</div>
      <div className="flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
          {[0, 0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--grid)" />)}
          <path d={path(b)} fill="none" stroke="#c8e86b" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={path(a)} fill="none" stroke="#ffb02e" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="mt-1 grid grid-cols-7 text-center text-[10px] text-muted">{days.map((d, i) => <span key={i}>{d}</span>)}</div>
      </div>
    </div>
  );
}

/** Money per day as stacked yellow blocks (like the heart-rate columns). */
function BlockColumns({ values }: { values: number[] }) {
  const days = useWeekdays();
  const max = Math.max(1, ...values);
  return (
    <div className="mt-3 grid grid-cols-7 gap-1.5">
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

/**
 * The "Wellness score" waves from the home page picture: three soft sine waves (orange, gold, white) that keep
 * flowing across and weaving through each other. Each wave is drawn twice as wide and slid left by exactly one
 * width, so the loop is seamless; each has its own speed so they keep crossing. A healthier team flows calmer.
 */
const WAVES = [
  { color: "#ff7a2e", amp: 0.34, cycles: 2, phase: 0, speed: 1, opacity: 0.95 },
  { color: "#ffc23d", amp: 0.26, cycles: 3, phase: 1.6, speed: 1.45, opacity: 0.9 },
  { color: "#f5f5f7", amp: 0.2, cycles: 2, phase: 3.1, speed: 0.75, opacity: 0.45 },
];
function Waves({ score }: { score: number | null }) {
  const W = 320, H = 70, mid = H / 2;
  const base = score === null ? 0 : score >= 75 ? 9 : score >= 50 ? 7 : 5; // seconds per loop
  const wave = (amp: number, cycles: number, phase: number) => {
    const n = 96;
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = (i / n) * W * 2, yy = mid + Math.sin((x / W) * cycles * Math.PI * 2 + phase) * amp * H;
      return `${i ? "L" : "M"} ${Math.round(x * 10) / 10} ${Math.round(yy * 10) / 10}`;
    }).join(" ");
  };
  return (
    <div aria-hidden className="relative mt-3 h-20 w-full overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      {WAVES.map((w, i) => (
        <div key={i} className={`absolute inset-y-0 left-0 w-[200%] ${base ? "wave-flow" : ""}`} style={{ animationDuration: `${base * w.speed}s` }}>
          <svg viewBox={`0 0 ${W * 2} ${H}`} preserveAspectRatio="none" className="size-full">
            <path d={base ? wave(w.amp, w.cycles, w.phase) : `M 0 ${mid} H ${W * 2}`} fill="none" stroke={w.color} strokeOpacity={base ? w.opacity : 0.25} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      ))}
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
export function HomeDashboard({ d, demo = false, canDemo = false }: { d: HomeData; demo?: boolean; canDemo?: boolean }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const examples = useMemo(() => [t("askPlaceholder"), ...(t.raw("askExamples") as string[])], [t]);
  const typed = useTypewriter(examples, q.length > 0);
  const ask = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) { window.dispatchEvent(new CustomEvent("emet:ask", { detail: q.trim() })); setQ(""); } };

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
        <span className="glass-pill h-11 shrink-0 px-4 text-sm text-white"><CalendarDays size={16} /> {d.weekLabel}</span>
        {d.canLogSale && <Link href="/g/finance?tab=books" className="glass-pill h-11 shrink-0 px-4 text-sm text-white"><Plus size={16} /> {t("logSale")}</Link>}
        <Link href="/today#report" className="glass-pill h-11 shrink-0 px-4 text-sm text-white"><FileText size={16} /> {t("report")}</Link>
        {canDemo && (
          <Link href={demo ? "/today" : "/today?demo=1"} title={t("demoHint")} aria-pressed={demo}
                className={`glass-pill h-11 shrink-0 px-4 text-sm font-semibold ${demo ? "!bg-[#ffc23d] text-black" : "text-white"}`}>
            <Sparkles size={16} /> {demo ? t("demoOff") : t("demoOn")}
          </Link>
        )}
      </div>
      {demo && (
        <p role="status" className="mb-3 self-center rounded-full bg-[#ffc23d] px-4 py-1.5 text-center text-sm font-bold text-black shadow-lg sm:self-end">{t("demoBadge")}</p>
      )}

      {/* Glass cards */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)] lg:gap-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          <Card icon={<Receipt size={19} />} title={t("sales")} note={t("last7")}>
            <ChannelStrip rows={d.sales.rows} />
            <p className="readout mt-3 text-3xl"><NumberTicker value={Math.round(d.sales.week)} locale={locale} options={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }} /></p>
            <p className="text-xs text-muted">{t("salesCount", { count: d.sales.count })}</p>
          </Card>
          <Card icon={<ListChecks size={19} />} title={t("tasks")} note={t("last7")}>
            <StepLines a={d.tasks.thisWeek} b={d.tasks.lastWeek} />
            <p className="readout mt-2 text-3xl">{d.tasks.done} <span className="text-base font-normal text-muted">{t("done")}</span></p>
            <p className="text-xs text-muted">{d.tasks.delta >= 0 ? "+" : ""}{d.tasks.delta} {t("vsLastWeek")}</p>
          </Card>
          <Card icon={<Coins size={19} />} title={t("money")} note={t("last7")} className="sm:col-span-2 lg:col-span-1">
            <BlockColumns values={d.money.days} />
            <p className="readout mt-2 text-3xl">{eur(d.money.week, locale)}</p>
            <p className="flex items-center gap-1 text-xs text-muted"><span className="text-[#ff7a2e]">●</span> {t("moneyNote")}</p>
          </Card>

          <section className="panel p-4 sm:col-span-2 sm:p-5 lg:col-span-1 lg:[grid-column:span_1]">
            <h2 className="text-[15px] font-medium">{t("health")}</h2>
            <div className="mt-1 text-center">
              <p className="readout text-3xl text-[#ff7a2e]">{d.health.score ?? "—"}</p>
              <p className="text-sm font-medium">{d.health.score === null ? t("noData") : d.health.score >= 75 ? t("good") : d.health.score >= 50 ? t("ok") : t("needsCare")}</p>
            </div>
            <Waves score={d.health.score} />
            <dl className="mt-2 grid grid-cols-3 text-xs">
              <div><dt className="text-muted">{t("onTime")}</dt><dd className="readout text-lg">{d.health.onTime === null ? "—" : `${Math.round(d.health.onTime * 100)}%`}</dd></div>
              <div className="text-center"><HeartPulse size={18} className="mx-auto text-muted" /><dd className="mt-0.5 text-muted">{t("insights")}</dd></div>
              <div className="text-right"><dt className="text-muted">{t("blockers")}</dt><dd className="readout text-lg">{d.health.blockers}</dd></div>
            </dl>
          </section>

          <section className="panel p-4 sm:col-span-2 sm:p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-medium">{t("yourWeek")}</h2>
              <div className="flex items-center gap-1.5 text-xs">
                {d.focus.score !== null && <span className="rounded-full bg-surface-2 px-2.5 py-1">{t("focusScore")} <b className="readout text-[#ff7a2e]">{d.focus.score}</b></span>}
                <span className="rounded-full bg-surface-2 px-2.5 py-1">{t("dueToday")} <b className="readout">{d.focus.dueToday}</b></span>
                {d.focus.late > 0 && <span className="rounded-full bg-bad/20 px-2.5 py-1 text-bad-text">{t("late")} <b className="readout">{d.focus.late}</b></span>}
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
