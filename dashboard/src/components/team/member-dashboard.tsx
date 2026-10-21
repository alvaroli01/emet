"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Mail, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { eur } from "@/lib/format";
import type { MemberData } from "@/lib/team-stats";
import { DocumentsSection } from "@/components/documents/documents-section";
import { MyProjects, type ProjectCard } from "@/components/projects/my-projects";
import { MyConnections } from "@/components/camp/ai-connections";

export type MemberInfo = { id: string; name: string; email: string; avatar: string | null; role: string | null; team: string | null; teamSlug: string | null };
const COLORS = ["#ff6a1a", "#ffb07a", "#ffc23d", "#8b8b93"];
const pad = (n: number) => String(n).padStart(2, "0");

function Tile({ label, value, unit, delta, good, href }: { label: string; value: string; unit: string; delta: string; good: boolean | null; href?: string }) {
  return (
    <section className="panel relative p-5">
      <p className="text-sm text-muted">{label}</p>
      {href && <Link href={href} aria-label={label} className="absolute top-4 right-4 grid size-9 place-items-center rounded-full ring-1 ring-line hover:bg-surface-2"><ArrowUpRight size={16} /></Link>}
      <p className="readout mt-2 text-4xl">{value}</p>
      <div className="mt-1 flex items-end justify-between gap-2 text-sm">
        <span>{unit}</span>
        <span className={good === null ? "text-muted" : good ? "text-ok-text" : "text-bad-text"}>{delta}</span>
      </div>
    </section>
  );
}

/** Time left until a due date, ticking every second like the timer in the example. */
function Countdown({ to }: { to: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (!to) return <span className="readout text-3xl">--:--:--</span>;
  const s = Math.max(0, Math.floor((Date.parse(to) - now) / 1000));
  const d = Math.floor(s / 86400);
  return <span className="readout text-3xl">{d ? `${d}d ` : ""}{pad(Math.floor((s % 86400) / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}</span>;
}

export function MemberDashboard({ p, d, today, isMe = false, isLeader = false, projects = [] }: { p: MemberInfo; d: MemberData; today: string; isMe?: boolean; isLeader?: boolean; projects?: ProjectCard[] }) {
  const t = useTranslations("member");
  const locale = useLocale();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
  const salesDelta = d.salesPrevMonth ? Math.round(((d.salesMonth - d.salesPrevMonth) / d.salesPrevMonth) * 100) : null;
  const doneDelta = d.completed7 - d.completedPrev7;
  const initials = p.name.split(/\s+/).map((x) => x.match(/\p{L}/u)?.[0] ?? "").join("").slice(0, 2).toUpperCase();

  // Month calendar (weeks start on Monday)
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + daysIn) / 7) * 7 }, (_, i) => new Date(Date.UTC(y, m - 1, 1 - lead + i)).toISOString().slice(0, 10));
  const shift = (n: number) => { const x = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(x.toISOString().slice(0, 7)); };
  const upcoming = d.due.filter((x) => x.day >= today && !x.done).slice(0, 4);
  const maxBar = Math.max(1, ...d.projects.days.map((x) => x.values.reduce((a, b) => a + b, 0)));
  const gauge = Math.min(1, d.weekPct);

  return (
    <div className="fade-in space-y-4">
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={15} /> {t("back")}</Link>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label={t("inProgress")} value={String(d.inProgress)} unit={t("tasks", { n: d.inProgress })} delta={t("newThisWeek", { n: d.newThisWeek })} good={null} href={p.teamSlug ? `/g/${p.teamSlug}?tab=board` : "/board"} />
        <Tile label={t("completed")} value={String(d.completed7)} unit={t("tasks", { n: d.completed7 })} delta={t("vsLastWeek", { n: sign(doneDelta) })} good={doneDelta === 0 ? null : doneDelta > 0} />
        <Tile label={t("sales")} value={eur(d.salesMonth, locale)} unit={t("perMonth")} delta={salesDelta === null ? t("noPrev") : t("vsLastMonth", { n: `${salesDelta > 0 ? "+" : ""}${salesDelta}%` })} good={salesDelta === null || salesDelta === 0 ? null : salesDelta > 0} href="/g/finance" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr_1fr]">
        {/* Profile + working format */}
        <div className="space-y-4">
          <section className="panel relative overflow-hidden p-0">
            <div className="relative aspect-[4/3.2] bg-[radial-gradient(120%_90%_at_50%_0%,rgb(255_106_26/0.45),transparent_70%),linear-gradient(180deg,var(--surface-2),var(--bg))]">
              {p.avatar
                ? <img src={p.avatar} alt="" className="absolute inset-0 size-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : <span aria-hidden className="absolute inset-0 grid place-items-center text-7xl font-medium tracking-tight text-white/90">{initials}</span>}
            </div>
            <div className="glass absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-medium">{p.name}</h1>
                <p className="truncate text-xs text-muted">{[p.role, p.team].filter(Boolean).join(" · ") || t("noRole")}</p>
              </div>
              <a href={`mailto:${p.email}`} aria-label={t("email", { name: p.name })} title={p.email} className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white"><Mail size={17} /></a>
            </div>
          </section>

          <section className="panel p-5">
            <p className="font-medium">{t("format")}</p>
            <div className="mt-4 grid h-44 grid-cols-2 items-end gap-3">
              {[{ k: "elsewhere", v: d.format.elsewhere, on: false }, { k: "own", v: d.format.own, on: true }].map((x) => (
                <div key={x.k} className={`flex flex-col justify-end rounded-2xl p-3 ${x.on ? "bg-[linear-gradient(180deg,#ff8a4a,#ff6a1a)] text-white" : "bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.06)_0_6px,transparent_6px_12px)] ring-1 ring-line"}`}
                     style={{ height: `${Math.max(35, Math.round(x.v * 100))}%` }}>
                  <p className="readout text-2xl">{Math.round(x.v * 100)}%</p>
                  <p className={`text-xs ${x.on ? "text-white/85" : "text-muted"}`}>{t(x.k === "own" ? "ownTeam" : "elsewhere")}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Weekly activity, current task, top projects */}
        <div className="space-y-4">
          <section className="panel p-5">
            <p className="font-medium">{t("weekly")}</p>
            <svg viewBox="0 0 200 110" className="mx-auto mt-2 w-full max-w-60" role="img" aria-label={`${Math.round(gauge * 100)}%`}>
              <defs><linearGradient id="mg" x1="0" x2="1"><stop offset="0" stopColor="#ff6a1a" /><stop offset="1" stopColor="#ffb07a" /></linearGradient></defs>
              <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--surface-2)" strokeWidth="26" />
              <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#mg)" strokeWidth="26" pathLength="100" strokeDasharray={`${gauge * 100} 100`} />
              <text x="100" y="96" textAnchor="middle" className="fill-ink" style={{ font: "500 28px var(--font-geist-sans)" }}>{Math.round(gauge * 100)}%</text>
            </svg>
            <p className="text-center text-xs text-muted">{t("weeklySub")}</p>
          </section>

          <section className="panel flex items-center gap-3 p-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-muted">{d.current?.title ?? t("noCurrent")}</p>
              <Countdown to={d.current?.due ?? null} />
              {d.current && <p className="text-[11px] text-muted">{t("untilDue")}</p>}
            </div>
            {d.current && <Link href={d.current.href} aria-label={t("openTask")} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Play size={18} fill="currentColor" className="ml-0.5" /></Link>}
          </section>

          <section className="panel p-5">
            <p className="font-medium">{t("topProjects")}</p>
            <div className="mt-4 grid h-44 grid-cols-5 items-end gap-2.5">
              {d.projects.days.map((day) => {
                const total = day.values.reduce((a, b) => a + b, 0);
                return (
                  <div key={day.label} className="flex h-full flex-col justify-end gap-1">
                    <div className="flex flex-col-reverse gap-0.5 overflow-hidden rounded-lg" style={{ height: `${(total / maxBar) * 100}%`, minHeight: 6 }}>
                      {total ? day.values.map((v, i) => v ? <div key={i} title={`${d.projects.names[i]}: ${v}`} style={{ flex: v, background: COLORS[i] }} className="rounded-md" /> : null)
                             : <div className="h-1.5 rounded-md bg-surface-2" />}
                    </div>
                    <p className="text-center text-[11px] text-muted">{day.label}</p>
                  </div>
                );
              })}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {d.projects.names.map((n, i) => <li key={n} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: COLORS[i] }} />{n}</li>)}
              {!d.projects.names.length && <li>{t("noActivity")}</li>}
            </ul>
          </section>
        </div>

        {/* Calendar + upcoming */}
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <button onClick={() => shift(-1)} aria-label={t("prevMonth")} className="grid size-9 place-items-center rounded-full ring-1 ring-line hover:bg-surface-2"><ChevronLeft size={16} /></button>
            <p className="font-medium capitalize">{first.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" })}</p>
            <button onClick={() => shift(1)} aria-label={t("nextMonth")} className="grid size-9 place-items-center rounded-full ring-1 ring-line hover:bg-surface-2"><ChevronRight size={16} /></button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-y-1 text-center text-sm">
            {cells.slice(0, 7).map((c) => <span key={"h" + c} className="pb-1 text-[11px] text-muted uppercase">{new Date(c + "T12:00:00Z").toLocaleDateString(locale, { weekday: "narrow", timeZone: "UTC" })}</span>)}
            {cells.map((c, i) => {
              const inMonth = c.slice(0, 7) === month, dots = d.due.filter((x) => x.day === c);
              return (
                <span key={c} className={`relative mx-auto grid size-9 place-items-center rounded-full tabular-nums ${c === today ? "bg-brand font-semibold text-white" : !inMonth ? "text-muted/40" : i % 7 >= 5 ? "text-bad-text" : ""}`}>
                  {Number(c.slice(8))}
                  {dots.length > 0 && <span className="absolute bottom-0.5 flex gap-0.5">{dots.slice(0, 3).map((x) => <span key={x.id} className={`size-1 rounded-full ${x.done ? "bg-ok" : c === today ? "bg-white" : "bg-brand"}`} />)}</span>}
                </span>
              );
            })}
          </div>
          <p className="mt-5 font-medium">{t("upcoming")}</p>
          <ul className="mt-2 space-y-2.5">
            {upcoming.map((x, i) => (
              <li key={x.id}>
                <Link href={x.href} className="flex items-center gap-3 rounded-xl py-1 hover:bg-surface-2">
                  <span className="w-20 shrink-0 text-xs text-muted">{new Date(x.day + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" })}</span>
                  <span className="h-8 w-0.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{x.title}</span>
                </Link>
              </li>
            ))}
            {!upcoming.length && <li className="py-3 text-sm text-muted">{t("noUpcoming")}</li>}
          </ul>
        </section>
      </div>

      {/* Only on your own profile: company documents (read only) and your private folder */}
      {isMe && <MyProjects projects={projects} today={today} />}
      {isMe && <DocumentsSection meId={p.id} isLeader={isLeader} />}
      {isMe && <MyConnections />}
    </div>
  );
}
