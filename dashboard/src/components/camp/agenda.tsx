"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2, Check, KanbanSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import type { DueTask } from "./week";
import { CalendarLink } from "./calendar-link";
import { GoogleCalendar } from "./google-calendar";

export type AgendaItem = { id: string; title: string; day: string; start_time: string | null; end_time: string | null; done: boolean };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Your days: what you planned yourself plus every card and small task due that day, in one list. */
export function AgendaTab({ items: initial, due, today }: { items: AgendaItem[]; due: DueTask[]; today: string }) {
  const t = useTranslations("camp.agenda");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initial);
  const [day, setDay] = useState(today);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => iso(new Date(Date.parse(today + "T12:00:00Z") + i * 864e5))), [today]);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { ...o, timeZone: "UTC" });
  const count = (d: string) => items.filter((i) => i.day === d && !i.done).length + due.filter((x) => x.day === d).length;

  const dayItems = items.filter((i) => i.day === day).sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99"));
  const dayDue = due.filter((x) => x.day === day);
  const overdue = day === today ? due.filter((x) => x.day < today) : [];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    const row: AgendaItem = { id: crypto.randomUUID(), title: text, day, start_time: time || null, end_time: null, done: false };
    setItems((x) => [...x, row]);
    setTitle(""); setTime("");
    const { error } = await supabase.from("agenda_items").insert(row);
    if (error) { setItems((x) => x.filter((i) => i.id !== row.id)); toast("error", t("saveError")); }
  }

  async function toggle(i: AgendaItem) {
    setItems((x) => x.map((y) => (y.id === i.id ? { ...y, done: !y.done } : y)));
    await supabase.from("agenda_items").update({ done: !i.done }).eq("id", i.id);
  }

  async function remove(i: AgendaItem) {
    setItems((x) => x.filter((y) => y.id !== i.id));
    await supabase.from("agenda_items").delete().eq("id", i.id);
  }

  return (
    <div className="space-y-4">
      <div role="listbox" aria-label={t("days")} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        {days.map((d) => {
          const active = d === day;
          const n = count(d);
          return (
            <button key={d} role="option" aria-selected={active} onClick={() => setDay(d)}
                    className={`flex w-16 shrink-0 snap-start flex-col items-center rounded-[12px] py-2.5 transition-[background,box-shadow,transform] duration-200 ${
                      active ? "bg-brand text-brand-contrast shadow-[var(--shadow-lift)]" : "bg-surface text-ink shadow-[var(--shadow)] hover:-translate-y-0.5"}`}>
              <span className={`text-[11px] ${active ? "opacity-80" : "text-muted"}`}>{d === today ? t("today") : fmt(d, { weekday: "short" })}</span>
              <span className="readout text-xl leading-tight">{fmt(d, { day: "numeric" })}</span>
              <span aria-label={t("itemsCount", { count: n })} className={`mt-0.5 h-1.5 w-1.5 rounded-full ${n ? (active ? "bg-brand-contrast" : "bg-trail") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      <section className="panel p-5">
        <h2 className="mb-4 text-lg font-semibold tracking-tight first-letter:uppercase">{fmt(day, { weekday: "long", day: "numeric", month: "long" })}</h2>

        <form onSubmit={add} className="mb-4 flex gap-2">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t("time")} className="input w-28 shrink-0" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("addPlaceholder")} className="input" />
          <button className="grid shrink-0 place-items-center rounded-xl bg-brand px-3 text-brand-contrast" aria-label={t("add")}><Plus size={18} /></button>
        </form>

        {!dayItems.length && !dayDue.length && !overdue.length ? (
          <p className="py-8 text-center text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className="relative space-y-1.5 before:absolute before:top-2 before:bottom-2 before:left-[3.25rem] before:w-px before:bg-line">
            {overdue.map((d) => <DueRow key={`o-${d.id}`} d={d} late label={t("overdue")} />)}
            {dayItems.map((i) => (
              <li key={i.id} className="group relative flex items-center gap-3 py-1.5">
                <span className="w-11 shrink-0 text-right text-xs text-muted tabular-nums">{i.start_time?.slice(0, 5) ?? "—"}</span>
                <button onClick={() => toggle(i)} aria-pressed={i.done} aria-label={i.title}
                        className={`relative z-10 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                          i.done ? "border-ok bg-ok text-white" : "border-line bg-surface hover:border-ink/40"}`}>
                  {i.done && <Check size={11} />}
                </button>
                <span className={`flex-1 text-sm ${i.done ? "text-muted line-through" : ""}`}>{i.title}</span>
                <button onClick={() => remove(i)} aria-label={t("delete")} className="p-1 text-muted hover:text-bad-text sm:opacity-0 sm:group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {dayDue.map((d) => <DueRow key={`d-${d.id}`} d={d} label={d.kind === "card" ? t("cardDue") : t("taskDue")} />)}
          </ul>
        )}
      </section>
      <CalendarLink />
      <GoogleCalendar />
    </div>
  );
}

function DueRow({ d, late = false, label }: { d: DueTask; late?: boolean; label: string }) {
  return (
    <li className="relative flex items-center gap-3 py-1.5">
      <span className={`w-11 shrink-0 text-right text-[11px] ${late ? "font-medium text-bad-text" : "text-muted"}`}>{label}</span>
      <span className="relative z-10 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"><KanbanSquare size={11} /></span>
      <Link href={d.href} className="min-w-0 flex-1 text-sm hover:underline">
        <span className="block truncate">{d.title}</span>
        {d.parent && <span className="block truncate text-xs text-muted">{d.parent}</span>}
      </Link>
    </li>
  );
}
