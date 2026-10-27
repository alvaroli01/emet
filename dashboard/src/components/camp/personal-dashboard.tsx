"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pause, Play, Star, ChevronRight, Plus, Video, CalendarClock, Check, Trash2, TrendingUp, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { PhoneWeek } from "@/components/home/phone-week";

export type PersonalData = {
  name: string; today: string; weekStart: string;
  focusTitle: string | null;
  tasks: { id: string; title: string; href: string; team: string | null }[];
  meetings: { id: string; title: string; time: string | null; href: string; kind: "agenda" | "meeting" | "google" }[];
  week: { id: string; title: string; day: string; status: "done" | "late" | "today" | "planned" | "google" | "notion"; team: string | null; href: string; time?: string | null }[];
  activity: { label: string; pct: number }[]; activityPct: number;
  worked: { name: string; color: string; share: number }[];
  reminders: { id: string; title: string; remind_at: string; priority: "low" | "medium" | "high"; done: boolean }[];
};

const STATUS = { done: "bg-ok/15 text-ok-text", late: "bg-bad/15 text-bad-text", today: "bg-warn/15 text-warn-text", planned: "bg-surface-2 text-muted", google: "bg-[#3b82f6]/20 text-[#93c5fd]", notion: "bg-[#8b5cf6]/20 text-[#c4b5fd]" } as const;
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;

/** Focus timer for today, kept on this device (per day) — like the big orange pause button in the example. */
function useFocusTimer(today: string) {
  const key = `emet-focus-${today}`;
  const [state, setState] = useState<{ elapsed: number; since: number | null }>({ elapsed: 0, since: null });
  const [, tick] = useState(0);
  useEffect(() => { try { const v = localStorage.getItem(key); if (v) setState(JSON.parse(v)); } catch { /* private mode */ } }, [key]);
  useEffect(() => { if (!state.since) return; const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, [state.since]);
  const save = (s: typeof state) => { setState(s); try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* ignore */ } };
  const seconds = state.elapsed + (state.since ? (Date.now() - state.since) / 1000 : 0);
  return { seconds, running: !!state.since, toggle: () => save(state.since ? { elapsed: seconds, since: null } : { elapsed: state.elapsed, since: Date.now() }) };
}

export function PersonalDashboard({ d }: { d: PersonalData }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const focus = useFocusTimer(d.today);
  const LIMIT = 6 * 3600;
  const [view, setView] = useState<"today" | "week">("today");
  const [adding, setAdding] = useState(false);
  const [rem, setRem] = useState({ title: "", time: "", priority: "medium" as "low" | "medium" | "high" });
  const days = Array.from({ length: 5 }, (_, i) => new Date(Date.parse(d.weekStart + "T00:00:00Z") + i * 864e5).toISOString().slice(0, 10));
  const nowPct = (() => { const n = new Date(); return Math.min(100, Math.max(0, ((n.getHours() - 8) * 60 + n.getMinutes()) / (12 * 60) * 100)); })();
  const cols = view === "today" ? days.filter((x) => x === d.today).concat(days.includes(d.today) ? [] : [d.today]) : days;

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!rem.title.trim() || !rem.time) return;
    const at = new Date(`${d.today}T${rem.time}:00`);
    const { error } = await supabase.from("reminders").insert({ title: rem.title.trim(), remind_at: at.toISOString(), priority: rem.priority });
    if (error) return toast("error", t("saveError"));
    setRem({ title: "", time: "", priority: "medium" }); setAdding(false); router.refresh();
  }
  async function patchReminder(id: string, row: Record<string, unknown> | null) {
    const { error } = row ? await supabase.from("reminders").update(row).eq("id", id) : await supabase.from("reminders").delete().eq("id", id);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }

  return (
    <div className="fade-in space-y-4">
      <h1 className="pt-1 text-[clamp(1.7rem,3.5vw,2.4rem)] font-medium tracking-tight">{t("title", { name: d.name })}</h1>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Focus */}
            <section className="panel flex flex-col items-center p-5 text-center">
              <p className="text-lg font-medium">{d.focusTitle ?? t("focus")}</p>
              <p className="text-xs text-muted">{t("focusSub")}</p>
              <button onClick={focus.toggle} aria-pressed={focus.running} aria-label={focus.running ? t("pause") : t("start")}
                      className="my-5 grid size-24 place-items-center rounded-full bg-brand text-white shadow-[0_0_0_10px_rgb(255_106_26/0.15),0_18px_40px_-10px_rgb(255_106_26/0.8)] transition active:scale-95">
                {focus.running ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" className="ml-1" />}
              </button>
              <dl className="grid w-full grid-cols-2 gap-2">
                <div className="glass-pill flex-col justify-center rounded-2xl py-2"><dt className="text-[11px] text-muted">{t("today")}</dt><dd className="readout text-lg">{hms(focus.seconds)}</dd></div>
                <div className="glass-pill flex-col justify-center rounded-2xl py-2"><dt className="text-[11px] text-muted">{t("goal")}</dt><dd className="readout text-lg">{hms(LIMIT)}</dd></div>
              </dl>
            </section>

            {/* Today's tasks */}
            <section className="panel p-5">
              <div className="flex items-center justify-between"><p className="font-medium">{t("todayTasks")} <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs">{d.tasks.length}</span></p>
                <Link href="/my-tasks" className="flex items-center text-xs text-link">{t("manage")} <ChevronRight size={13} /></Link></div>
              <ul className="mt-3 space-y-2">
                {d.tasks.slice(0, 4).map((x, i) => (
                  <li key={x.id}>
                    <Link href={x.href} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5 transition hover:brightness-125">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${i === 0 ? "bg-brand text-white" : "ring-1 ring-line text-ink"}`}><Play size={13} fill="currentColor" className="ml-0.5" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm">{x.title}</span><span className="block truncate text-xs text-link">{x.team ?? t("company")}</span></span>
                      <Star size={14} className="text-muted" />
                    </Link>
                  </li>
                ))}
                {!d.tasks.length && <li className="py-6 text-center text-sm text-muted">{t("noTasks")}</li>}
              </ul>
            </section>

            {/* Today's meetings */}
            <section className="panel p-5">
              <div className="flex items-center justify-between"><p className="font-medium">{t("todayMeetings")} <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs">{d.meetings.length}</span></p>
                <Link href="/camp?tab=agenda#camp-tabs" className="flex items-center text-xs text-link">{t("viewAll")} <ChevronRight size={13} /></Link></div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {d.meetings.slice(0, 3).map((m, i) => (
                  <Link key={m.id} href={m.href} {...(m.kind === "google" ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`relative rounded-2xl p-3 ${i === 0 ? "bg-[linear-gradient(160deg,rgb(255_106_26/0.35),rgb(255_106_26/0.08))] ring-1 ring-brand/40" : "bg-surface-2"}`}>
                    <span className="flex items-start justify-between"><span className="readout text-lg">{m.time ?? "—"}</span>{m.kind === "meeting" ? <Video size={14} className="text-muted" /> : m.kind === "google" ? <CalendarDays size={14} className="text-[#93c5fd]" /> : <CalendarClock size={14} className="text-muted" />}</span>
                    <span className="mt-1 line-clamp-2 block text-xs text-muted">{m.title}</span>
                  </Link>
                ))}
                <Link href="/camp?tab=agenda#camp-tabs" className="grid place-items-center rounded-2xl bg-brand-soft p-3 text-center text-xs font-medium text-link ring-1 ring-brand/30">
                  <span><span className="mx-auto mb-1 grid size-8 place-items-center rounded-full ring-1 ring-brand/50"><Plus size={15} /></span>{t("schedule")}</span>
                </Link>
              </div>
            </section>
          </div>

          {/* Week board */}
          <section className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-medium">{t("myWeek")}</p>
              <div className="glass-pill p-1 text-sm max-sm:hidden" role="tablist">
                {(["today", "week"] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-full px-3.5 py-1.5 ${view === v ? "bg-ink font-medium text-bg" : "text-muted"}`}>{t(v === "today" ? "viewToday" : "viewWeek")}</button>)}
              </div>
            </div>
            {/* Phones: small day buttons + a short list; the board below is for the computer */}
            <PhoneWeek days={days} today={d.today} allDay={t("allDay")} empty={t("dayEmpty")}
              items={d.week.map((x) => ({ id: x.id, title: x.title, day: x.day, href: x.href, time: x.time ?? null, meta: x.team,
                google: x.status === "google", notion: x.status === "notion", done: x.status === "done", late: x.status === "late" }))} />
            <div className="mt-4 overflow-x-auto max-sm:hidden">
              <div className="grid min-w-[680px] gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
                {cols.map((day) => {
                  const isToday = day === d.today;
                  const items = d.week.filter((x) => x.day === day).sort((a, b) => Number(a.status === "google") - Number(b.status === "google") || (a.time ?? "").localeCompare(b.time ?? ""));
                  return (
                    <div key={day} className={`relative min-h-64 rounded-2xl p-2 ${isToday ? "bg-[linear-gradient(180deg,rgb(239_68_68/0.22),rgb(239_68_68/0.04))] ring-1 ring-bad/30" : "bg-surface-2/60"}`}>
                      <p className={`px-1 pb-2 text-xs font-medium uppercase ${isToday ? "text-bad-text" : "text-muted"}`}>{new Date(day + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric", timeZone: "UTC" })}</p>
                      {isToday && <span aria-hidden className="pointer-events-none absolute inset-x-0 h-px bg-bad" style={{ top: `${12 + nowPct * 0.8}%` }}><span className="absolute -top-1 -left-1 size-2 rounded-full bg-bad" /></span>}
                      <ul className="space-y-2">
                        {items.map((x) => (
                          <li key={x.id}>
                            <Link href={x.href} {...(x.status === "google" || x.status === "notion" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                  className={`block rounded-xl p-2.5 ring-1 transition hover:ring-brand/50 ${x.status === "google" ? "bg-[#3b82f6]/12 ring-[#60a5fa]/35" : x.status === "notion" ? "bg-[#8b5cf6]/12 ring-[#a78bfa]/35" : "bg-solid/80 ring-line"}`}>
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS[x.status]}`}><span className="size-1.5 rounded-full bg-current" />{x.status === "google" ? (x.time ?? t("allDay")) : x.status === "notion" ? (x.time ?? "Notion") : t(`card.${x.status}`)}</span>
                              <span className={`mt-1.5 block text-sm leading-snug ${x.status === "done" ? "text-muted line-through" : ""}`}>{x.title}</span>
                              {x.team && <span className="mt-1 block text-[11px] text-muted">{x.team}</span>}
                            </Link>
                          </li>
                        ))}
                        {!items.length && <li className="rounded-xl border border-dashed border-line py-6 text-center text-[11px] text-muted">{t("free")}</li>}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Right column: activity, worked on, reminders */}
        <div className="space-y-4">
          <section className="panel p-5">
            <p className="flex items-center justify-between font-medium">{t("activity")} <span className="flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok-text"><TrendingUp size={12} /> {t("thisWeek")}</span></p>
            <p className="readout mt-2 text-3xl">{Math.round(d.activityPct * 100)}%</p>
            <div className="mt-3 grid h-32 grid-cols-5 items-end gap-1.5">
              {d.activity.map((a) => (
                <div key={a.label} className="flex h-full flex-col justify-end gap-1">
                  <div className="relative flex-1 overflow-hidden rounded-lg bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.05)_0_4px,transparent_4px_8px)]">
                    <div className="absolute inset-x-0 bottom-0 rounded-lg bg-white/60" style={{ height: `${Math.round(a.pct * 100)}%` }} />
                  </div>
                  <p className="text-center text-[10px] text-muted">{a.label}<br /><b className="text-ink">{Math.round(a.pct * 100)}%</b></p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <p className="font-medium">{t("worked")}</p>
            <div className="mt-3 flex items-center gap-4">
              <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" aria-hidden>
                {(() => { let off = 0; const c = 2 * Math.PI * 38; return d.worked.map((w) => { const len = w.share * c; const el = <circle key={w.name} cx="50" cy="50" r="38" fill="none" stroke={w.color} strokeWidth="12" strokeDasharray={`${Math.max(0, len - 3)} ${c}`} strokeDashoffset={-off} strokeLinecap="round" />; off += len; return el; }); })()}
                {!d.worked.length && <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface-2)" strokeWidth="12" />}
              </svg>
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {d.worked.map((w) => <li key={w.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: w.color }} /><span className="flex-1 truncate">{w.name}</span><span className="text-muted tabular-nums">{Math.round(w.share * 100)}%</span></li>)}
                {!d.worked.length && <li className="text-xs text-muted">{t("noWork")}</li>}
              </ul>
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between"><p className="font-medium">{t("reminders")}</p>
              <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1 text-xs text-link"><Plus size={13} /> {t("add")}</button></div>
            {adding && (
              <form onSubmit={addReminder} className="mt-3 space-y-2 rounded-2xl bg-surface-2 p-3">
                <input autoFocus required value={rem.title} onChange={(e) => setRem({ ...rem, title: e.target.value })} placeholder={t("whatToRemember")} aria-label={t("whatToRemember")} className="input" />
                <div className="grid grid-cols-2 gap-2">
                  <input required type="time" value={rem.time} onChange={(e) => setRem({ ...rem, time: e.target.value })} aria-label={t("time")} className="input" />
                  <select value={rem.priority} onChange={(e) => setRem({ ...rem, priority: e.target.value as "low" | "medium" | "high" })} aria-label={t("priority")} className="input">
                    {(["low", "medium", "high"] as const).map((p) => <option key={p} value={p}>{t(`status.${p}`)}</option>)}
                  </select>
                </div>
                <button className="w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-white">{t("save")}</button>
              </form>
            )}
            <ul className="mt-3 space-y-2">
              {d.reminders.map((r) => {
                const tm = new Date(r.remind_at);
                return (
                  <li key={r.id} className={`group rounded-2xl bg-surface-2 p-3.5 ${r.done ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="readout text-2xl">{tm.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</p>
                      <span className={`inline-flex items-center gap-1 text-[11px] ${r.priority === "high" ? "text-bad-text" : r.priority === "medium" ? "text-warn-text" : "text-ok-text"}`}>{t(`status.${r.priority}`)} <span className="size-1.5 rounded-full bg-current" /></span>
                    </div>
                    <p className={`mt-0.5 text-sm ${r.done ? "line-through" : ""}`}>{r.title}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button onClick={() => patchReminder(r.id, { done: !r.done })} className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs hover:text-ok-text"><Check size={12} /> {r.done ? t("undo") : t("done")}</button>
                      <button onClick={() => patchReminder(r.id, null)} aria-label={t("delete")} className="grid size-7 place-items-center rounded-full text-muted hover:text-bad-text"><Trash2 size={13} /></button>
                    </div>
                  </li>
                );
              })}
              {!d.reminders.length && !adding && <li className="py-4 text-center text-sm text-muted">{t("noReminders")}</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
