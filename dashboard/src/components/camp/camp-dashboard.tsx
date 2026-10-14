"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock, FileText, Lightbulb, KeyRound, ListTodo, Home, Mic, ChevronRight, CheckCircle2, Tent } from "lucide-react";
import { MountainLazy } from "@/components/summit/mountain-lazy";

export type CampData = {
  name: string;
  priorities: { done: number; total: number };
  weekDone: number; // 0..1 of the week passed
  dueThisWeek: number; lateCount: number;
  agendaToday: number; next: { title: string; time: string | null } | null;
  agendaWeek: number[]; // items per day Mon..Sun
  docs: number; shared: number; ideas: number;
  setup: { ai: boolean; vault: boolean; calendar: boolean };
  revenuePct: number; tasksDonePct: number | null;
};

/** A ring like "Filter health 90%". */
function Ring({ value, label, sub }: { value: number | null; label: string; sub: string }) {
  const r = 30, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className="panel flex items-center justify-between gap-2 p-4">
      <div><p className="text-[17px] font-medium">{label}</p><p className="mt-3 text-xs text-muted">{sub}</p></div>
      <div className="relative grid size-20 place-items-center">
        <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(0 0 0 / 0.08)" strokeWidth="9" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f26a1b" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} />
        </svg>
        <span className="readout text-base">{value === null ? "—" : `${Math.round(v * 100)}%`}</span>
      </div>
    </div>
  );
}

/** A thumb-style progress bar with striped "remaining" part (like the "Dust box" tile). */
function Thumb({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative mt-4 h-6 rounded-full bg-white/70 shadow-inner">
      <div className="absolute inset-y-1 left-1 rounded-full bg-white shadow" style={{ width: `calc(${Math.max(8, v * 100)}% - 8px)` }} />
      <span className="absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full bg-[#1c1c22]" />
      <div className="absolute inset-y-1.5 right-2 flex gap-[3px]">{Array.from({ length: 8 }, (_, i) => <span key={i} className="w-[2px] rounded bg-black/20" />)}</div>
    </div>
  );
}

/** Callout label linked to a spot on the 3D scene (like "Dining room" in the example). */
function Callout({ href, title, text, className, line }: { href: string; title: string; text: string; className: string; line: string }) {
  return (
    <>
      {/* Connector line on a 0–100 grid that stretches with the scene */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path d={line} fill="none" stroke="#1c1c22" strokeOpacity="0.5" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <Link href={href} className={`panel absolute z-10 max-w-[180px] rounded-2xl p-3 transition hover:-translate-y-0.5 ${className}`}>
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="mt-1 block text-xs leading-snug text-muted">{text}</span>
      </Link>
    </>
  );
}

/** Base camp — modelled on the "personal dashboard" example: tiles on the left, your 3D camp on the right. */
export function CampDashboard({ d }: { d: CampData }) {
  const t = useTranslations("campDash");
  const locale = useLocale();
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: "narrow", timeZone: "UTC" }));
  const maxA = Math.max(1, ...d.agendaWeek);
  const prioPct = d.priorities.total ? d.priorities.done / d.priorities.total : 0;
  const gauge = (v: number) => { const a = Math.PI * (1 - v); return [60 + 44 * Math.cos(a), 60 - 44 * Math.sin(a)]; };
  const [gx, gy] = gauge(prioPct);

  return (
    <section className="light-glass fade-in rounded-[34px] bg-[var(--bg)] p-3 text-ink sm:p-4" style={{ background: "linear-gradient(160deg, #e4e4df, #cfcfc9)" }}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        {/* Left: tiles */}
        <div className="panel grid content-start gap-3 rounded-[28px] p-3 sm:grid-cols-6">
          <div className="panel rounded-[22px] p-4 sm:col-span-3">
            <p className="flex items-center justify-between text-[17px]">{t("priorities")} <ListTodo size={18} className="text-[#2f5bea]" /></p>
            <p className="readout mt-3 text-3xl">{d.priorities.done}<span className="text-base text-muted">/{d.priorities.total || 3}</span></p>
            <Thumb value={prioPct} />
          </div>
          <div className="panel rounded-[22px] p-4 sm:col-span-2">
            <p className="text-[17px] leading-tight">{t("week")}</p>
            <div className="relative mx-auto mt-3 h-24 w-16 overflow-hidden rounded-xl border-2 border-white bg-white/50">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2f5bea] to-[#6f8dff]" style={{ height: `${Math.round(d.weekDone * 100)}%` }} />
              <span className="absolute inset-x-0 top-2 text-center text-xs font-semibold text-[#2f5bea]">{Math.round(d.weekDone * 100)}%</span>
            </div>
          </div>
          <div className="grid gap-3 sm:col-span-1">
            <Link href="/camp?tab=agenda" className="panel rounded-[18px] p-3"><p className="text-xs font-medium">{t("today")}</p><p className="readout text-xl">{d.agendaToday}</p></Link>
            <Link href="/camp?tab=docs" className="panel rounded-[18px] p-3"><p className="text-xs font-medium">{t("docs")}</p><p className="readout text-xl">{d.docs}</p></Link>
          </div>

          <div className="panel relative overflow-hidden rounded-[22px] p-4 sm:col-span-3">
            <p className="relative z-10 flex items-center justify-between text-[17px]">{t("dueThisWeek")} <CalendarDays size={18} className="text-[#2f5bea]" /></p>
            <p className="readout relative z-10 mt-3 text-3xl">{d.dueThisWeek}<span className="text-base text-muted"> {t("tasks")}</span></p>
            <svg viewBox="0 0 200 60" className="absolute inset-x-0 bottom-0 h-1/2 w-full" preserveAspectRatio="none" aria-hidden>
              <path d={`M0 ${60 - Math.min(50, 10 + d.dueThisWeek * 6)} C 60 ${40 - Math.min(40, d.dueThisWeek * 5)}, 120 ${70 - Math.min(50, 10 + d.dueThisWeek * 6)}, 200 ${45 - Math.min(40, d.dueThisWeek * 5)} L200 60 L0 60 Z`} fill="#a99be8" fillOpacity="0.75" />
            </svg>
            {d.lateCount > 0 && <p className="relative z-10 mt-6 text-xs font-medium text-bad-text">{t("late", { count: d.lateCount })}</p>}
          </div>
          <div className="panel rounded-[22px] p-4 sm:col-span-3">
            <p className="text-[17px]">{t("setup")}</p>
            <ul className="mt-3 space-y-2.5 text-sm">
              {([["ai", t("aiNotes"), d.setup.ai], ["vault", t("vault"), d.setup.vault], ["calendar", t("calendar"), d.setup.calendar]] as const).map(([k, label, on]) => (
                <li key={k} className="flex items-center justify-between gap-2"><span className="text-muted">{label}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${on ? "bg-[#dfe7ff] text-[#2f5bea]" : "bg-[#ffe1e1] text-[#c43b3b]"}`}>{on ? t("on") : t("off")}</span></li>
              ))}
            </ul>
          </div>

          <div className="panel rounded-[22px] p-4 sm:col-span-3">
            <p className="text-[17px]">{t("focus")}</p>
            <svg viewBox="0 0 120 70" className="mx-auto mt-1 w-40" aria-hidden>
              <path d="M16 60 A44 44 0 0 1 104 60" fill="none" stroke="rgb(0 0 0 / 0.08)" strokeWidth="10" strokeLinecap="round" />
              <path d={`M16 60 A44 44 0 0 1 ${gx} ${gy}`} fill="none" stroke="#f9a65a" strokeWidth="10" strokeLinecap="round" />
              <circle cx={gx} cy={gy} r="7" fill="#2f5bea" stroke="white" strokeWidth="3" />
            </svg>
            <p className="readout -mt-6 text-center text-2xl">{Math.round(prioPct * 100)}</p>
            <p className="text-center text-[10px] text-muted">{t("focusSub")}</p>
          </div>
          <div className="panel rounded-[22px] p-4 sm:col-span-3">
            <p className="flex items-center justify-between text-[17px]">{t("agendaWeek")} <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px]">{t("weekly")}</span></p>
            <p className="readout mt-2 text-2xl">{d.agendaWeek.reduce((a, b) => a + b, 0)} <span className="text-sm font-normal text-muted">{t("plans")}</span></p>
            <div className="mt-3 flex h-14 items-end justify-between gap-1">
              {d.agendaWeek.map((v, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="w-1.5 rounded-full bg-[#f26a1b]" style={{ height: `${v ? 20 + (v / maxA) * 80 : 10}%`, opacity: v ? 1 : 0.25 }} />
                  <span className="text-[9px] text-muted">{days[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[22px] p-4 sm:col-span-6">
            <p className="flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-[#10b981]" /> {t("status")}: <span className="font-medium text-[#f26a1b]">{d.next ? t("busy") : t("free")}</span></p>
            <p className="mt-1.5 text-sm">{d.next ? t("nextUp", { title: d.next.title, time: d.next.time ?? "" }) : t("nothingNext")}</p>
            <Link href="/camp?tab=docs" className="mt-3 flex items-center gap-2 rounded-2xl bg-black/[0.07] px-4 py-3 text-sm"><Mic size={15} /> {t("recordClass")}<ChevronRight size={15} className="ml-auto text-muted" /></Link>
          </div>

          <div className="grid gap-3 sm:col-span-6 sm:grid-cols-2">
            <Ring value={d.tasksDonePct} label={t("tasksDone")} sub={t("tasksDoneSub")} />
            <Ring value={d.revenuePct} label={t("teamGoal")} sub={t("teamGoalSub")} />
          </div>
        </div>

        {/* Right: nav bar + 3D camp with callouts */}
        <div className="flex min-h-[560px] flex-col gap-3">
          <div className="panel flex items-center gap-2 rounded-[22px] px-4 py-2.5">
            <span className="flex items-center gap-2 text-lg font-semibold text-[#2f5bea]"><Tent size={20} /> {t("title", { name: d.name })}</span>
            <nav className="mx-auto hidden items-center gap-1 sm:flex" aria-label={t("areas")}>
              {([["week", Home], ["agenda", CalendarDays], ["docs", FileText], ["ideas", Lightbulb], ["vault", KeyRound]] as const).map(([k, Icon]) => (
                <Link key={k} href={`/camp?tab=${k}#camp-tabs`} title={t(`areaNames.${k}`)} aria-label={t(`areaNames.${k}`)} className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-white/70 hover:text-ink"><Icon size={18} /></Link>
              ))}
            </nav>
          </div>
          <div className="panel relative flex-1 overflow-hidden rounded-[26px]">
            <div className="absolute inset-0">
              <MountainLazy className="size-full" variant="camp" progress={d.revenuePct} ariaLabel={t("sceneLabel")} labels={{ summit: "", camp: t("yourCamp") }} />
            </div>
            <div className="pointer-events-none absolute inset-0 hidden md:block [&_a]:pointer-events-auto">
              <Callout href="/camp?tab=week#camp-tabs" title={t("areaNames.week")} text={t("areaText.week")} className="top-[6%] left-[16%]" line="M 28 18 L 34 18 L 34 34" />
              <Callout href="/camp?tab=agenda#camp-tabs" title={t("areaNames.agenda")} text={t("areaText.agenda")} className="top-[4%] right-[6%]" line="M 76 16 L 66 16 L 66 32" />
              <Callout href="/camp?tab=docs#camp-tabs" title={t("areaNames.docs")} text={t("areaText.docs")} className="bottom-[16%] left-[6%]" line="M 16 78 L 16 66 L 30 66" />
              <Callout href="/camp?tab=ideas#camp-tabs" title={t("areaNames.ideas")} text={t("areaText.ideas")} className="right-[4%] bottom-[22%]" line="M 84 74 L 84 62 L 72 62" />
              <Callout href="/camp?tab=vault#camp-tabs" title={t("areaNames.vault")} text={t("areaText.vault")} className="bottom-[4%] left-[38%]" line="M 50 90 L 50 80" />
            </div>
            <div className="absolute inset-x-0 bottom-4 flex justify-center md:hidden">
              <span className="panel flex items-center gap-2 rounded-2xl p-1.5 text-xs text-muted"><CheckCircle2 size={14} /> {t("tapAreas")}</span>
            </div>
          </div>
          <div className="mx-auto flex items-center gap-4 rounded-[22px] bg-white/60 p-1.5 shadow">
            <Link href="/camp?tab=week#camp-tabs" aria-label={t("areaNames.week")} className="grid size-12 place-items-center rounded-2xl bg-[#f26a1b] text-white"><Home size={20} /></Link>
            <span aria-hidden className="flex text-[#2f5bea]"><ChevronRight size={22} /><ChevronRight size={22} className="-ml-2.5 opacity-70" /><ChevronRight size={22} className="-ml-2.5 opacity-40" /></span>
            <Link href="/camp?tab=docs#camp-tabs" aria-label={t("recordClass")} className="grid size-12 place-items-center rounded-2xl bg-[#2f5bea] text-white"><Clock size={20} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
